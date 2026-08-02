"""Security Testing Plan §2 "File Upload" and "Crypto" cases, against a real Postgres
instance and real on-disk (tmp) storage."""

import uuid

import pytest

from app.core.errors import ConflictError, PermissionDeniedError
from app.core.security.virus_scan import ScanResult, VirusScanner
from app.core.storage import FileStorage
from app.domain.models.organization import Organization
from app.domain.models.project import Project
from app.services import document_service
from tests.integration.conftest import make_user


class _AlwaysCleanScanner(VirusScanner):
    async def scan(self, data: bytes) -> ScanResult:
        return ScanResult(clean=True)


class _AlwaysInfectedScanner(VirusScanner):
    async def scan(self, data: bytes) -> ScanResult:
        return ScanResult(clean=False, signature="EICAR-Test-Signature")


@pytest.fixture
def storage(tmp_path) -> FileStorage:
    return FileStorage(str(tmp_path))


async def _seed_org_project(session):
    org = Organization(name="Acme", slug=f"acme-{uuid.uuid4().hex[:8]}")
    session.add(org)
    await session.flush()
    creator = await make_user(session)
    project = Project(organization_id=org.id, name="Proj", created_by=creator.id)
    session.add(project)
    await session.commit()
    return org, project


async def test_upload_and_download_round_trip(session, settings, storage) -> None:
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)
    content = b"%PDF-1.4 confidential financial statement"

    document, version = await document_service.upload_document(
        session, settings, storage, _AlwaysCleanScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/finance", name="Q3 statement",
        filename="q3.pdf", mime_type="application/pdf", data=content, uploaded_by=uploader.id,
    )
    await session.commit()

    assert version.scan_status == "clean"
    assert document.current_version_id == version.id

    decrypted = await document_service.get_decrypted_content(
        settings, storage, organization_id=org.id, version=version
    )
    assert decrypted == content


async def test_stored_blob_on_disk_is_not_plaintext(session, settings, storage, tmp_path) -> None:
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)
    content = b"%PDF-1.4 the secret merger terms are 40 million dollars"

    _document, version = await document_service.upload_document(
        session, settings, storage, _AlwaysCleanScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/", name="doc",
        filename="doc.pdf", mime_type="application/pdf", data=content, uploaded_by=uploader.id,
    )
    await session.commit()

    raw_on_disk = (tmp_path / version.storage_key).read_bytes()
    assert b"merger" not in raw_on_disk
    assert b"40 million" not in raw_on_disk


async def test_infected_file_is_recorded_but_never_downloadable(session, settings, storage) -> None:
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)
    content = b"%PDF-1.4 malicious payload disguised as a pdf"

    document, version = await document_service.upload_document(
        session, settings, storage, _AlwaysInfectedScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/", name="bad",
        filename="bad.pdf", mime_type="application/pdf", data=content, uploaded_by=uploader.id,
    )
    await session.commit()

    assert version.scan_status == "infected"

    with pytest.raises(PermissionDeniedError):
        await document_service.get_decrypted_content(settings, storage, organization_id=org.id, version=version)


async def test_new_version_resets_approval_status(session, settings, storage) -> None:
    """Threat Model: silently swapping content on an already-approved document must
    not leave the stale 'approved' status attached to unreviewed content."""
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)

    document, _v1 = await document_service.upload_document(
        session, settings, storage, _AlwaysCleanScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/", name="doc",
        filename="doc.pdf", mime_type="application/pdf", data=b"%PDF-1.4 v1", uploaded_by=uploader.id,
    )
    document.status = "approved"
    await session.commit()

    await document_service.upload_new_version(
        session, settings, storage, _AlwaysCleanScanner(),
        document_id=document.id, organization_id=org.id, filename="doc.pdf", mime_type="application/pdf",
        data=b"%PDF-1.4 v2 with different content", uploaded_by=uploader.id,
    )
    assert document.status == "draft"


async def test_checkout_prevents_concurrent_checkout(session, settings, storage) -> None:
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)
    document, _v = await document_service.upload_document(
        session, settings, storage, _AlwaysCleanScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/", name="doc",
        filename="doc.pdf", mime_type="application/pdf", data=b"%PDF-1.4 content", uploaded_by=uploader.id,
    )
    await session.commit()

    user_a = await make_user(session)
    user_b = await make_user(session)
    await document_service.checkout(session, document_id=document.id, user_id=user_a.id)

    with pytest.raises(ConflictError):
        await document_service.checkout(session, document_id=document.id, user_id=user_b.id)


async def test_checkin_by_non_owner_requires_override(session, settings, storage) -> None:
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)
    document, _v = await document_service.upload_document(
        session, settings, storage, _AlwaysCleanScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/", name="doc",
        filename="doc.pdf", mime_type="application/pdf", data=b"%PDF-1.4 content", uploaded_by=uploader.id,
    )
    await session.commit()

    owner = await make_user(session)
    other = await make_user(session)
    await document_service.checkout(session, document_id=document.id, user_id=owner.id)

    with pytest.raises(PermissionDeniedError):
        await document_service.checkin(session, document_id=document.id, user_id=other.id, can_override=False)

    # A project_admin (can_override=True) CAN force a check-in.
    await document_service.checkin(session, document_id=document.id, user_id=other.id, can_override=True)
    assert document.checked_out_by is None


async def test_upload_new_version_blocked_while_checked_out_by_another_user(session, settings, storage) -> None:
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)
    document, _v = await document_service.upload_document(
        session, settings, storage, _AlwaysCleanScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/", name="doc",
        filename="doc.pdf", mime_type="application/pdf", data=b"%PDF-1.4 content", uploaded_by=uploader.id,
    )
    await session.commit()

    owner = await make_user(session)
    other = await make_user(session)
    await document_service.checkout(session, document_id=document.id, user_id=owner.id)

    with pytest.raises(ConflictError):
        await document_service.upload_new_version(
            session, settings, storage, _AlwaysCleanScanner(),
            document_id=document.id, organization_id=org.id, filename="doc.pdf", mime_type="application/pdf",
            data=b"%PDF-1.4 sneaky overwrite", uploaded_by=other.id,
        )


async def test_cannot_approve_an_already_approved_document(session, settings, storage) -> None:
    """Pentest Checklist §5: approval workflow bypass via a replayed/duplicated
    direct API call — approving twice must not be silently accepted."""
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)
    document, _v = await document_service.upload_document(
        session, settings, storage, _AlwaysCleanScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/", name="doc",
        filename="doc.pdf", mime_type="application/pdf", data=b"%PDF-1.4 content", uploaded_by=uploader.id,
    )
    await session.commit()

    await document_service.approve(session, document_id=document.id)
    assert document.status == "approved"

    with pytest.raises(ConflictError):
        await document_service.approve(session, document_id=document.id)


async def test_cannot_reject_an_already_rejected_document(session, settings, storage) -> None:
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)
    document, _v = await document_service.upload_document(
        session, settings, storage, _AlwaysCleanScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/", name="doc",
        filename="doc.pdf", mime_type="application/pdf", data=b"%PDF-1.4 content", uploaded_by=uploader.id,
    )
    await session.commit()

    await document_service.reject(session, document_id=document.id)
    with pytest.raises(ConflictError):
        await document_service.reject(session, document_id=document.id)


async def test_new_version_after_approval_allows_resubmission(session, settings, storage) -> None:
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)
    document, _v = await document_service.upload_document(
        session, settings, storage, _AlwaysCleanScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/", name="doc",
        filename="doc.pdf", mime_type="application/pdf", data=b"%PDF-1.4 v1", uploaded_by=uploader.id,
    )
    await session.commit()

    await document_service.approve(session, document_id=document.id)
    assert document.status == "approved"

    # A new version resets to 'draft' (existing behavior), which makes it approvable
    # again — the workflow can restart cleanly rather than staying permanently locked.
    await document_service.upload_new_version(
        session, settings, storage, _AlwaysCleanScanner(),
        document_id=document.id, organization_id=org.id, filename="doc.pdf", mime_type="application/pdf",
        data=b"%PDF-1.4 v2", uploaded_by=uploader.id,
    )
    assert document.status == "draft"
    await document_service.approve(session, document_id=document.id)
    assert document.status == "approved"


async def test_submit_for_approval_transitions_draft_to_pending(session, settings, storage) -> None:
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)
    document, _v = await document_service.upload_document(
        session, settings, storage, _AlwaysCleanScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/", name="doc",
        filename="doc.pdf", mime_type="application/pdf", data=b"%PDF-1.4 content", uploaded_by=uploader.id,
    )
    await session.commit()

    await document_service.submit_for_approval(session, document_id=document.id)
    assert document.status == "pending_approval"

    with pytest.raises(ConflictError):
        await document_service.submit_for_approval(session, document_id=document.id)


async def test_checkout_race_does_not_double_lock(settings, storage) -> None:
    """Pentest Checklist §4: simultaneous document check-out by two users — two
    concurrent checkout calls from separate DB connections must not both succeed."""
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.core.db import create_engine
    from app.domain.models.base import Base

    engine = create_engine(settings)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as setup_session:
        org, project = await _seed_org_project(setup_session)
        uploader = await make_user(setup_session)
        document, _v = await document_service.upload_document(
            setup_session, settings, storage, _AlwaysCleanScanner(),
            project_id=project.id, organization_id=org.id, folder_path="/", name="doc",
            filename="doc.pdf", mime_type="application/pdf", data=b"%PDF-1.4 content", uploaded_by=uploader.id,
        )
        contender_a = await make_user(setup_session)
        contender_b = await make_user(setup_session)
        await setup_session.commit()
        document_id = document.id

    async def _try_checkout(user_id: uuid.UUID) -> bool:
        async with factory() as s:
            try:
                async with s.begin():
                    await document_service.checkout(s, document_id=document_id, user_id=user_id)
                return True
            except ConflictError:
                return False

    results = await asyncio.gather(_try_checkout(contender_a.id), _try_checkout(contender_b.id))
    assert sorted(results) == [False, True]  # exactly one winner, never both, never neither

    await engine.dispose()


async def test_search_finds_document_by_name(session, settings, storage) -> None:
    org, project = await _seed_org_project(session)
    uploader = await make_user(session)
    document, _v = await document_service.upload_document(
        session, settings, storage, _AlwaysCleanScanner(),
        project_id=project.id, organization_id=org.id, folder_path="/", name="Acquisition Term Sheet",
        filename="terms.pdf", mime_type="application/pdf", data=b"%PDF-1.4 content", uploaded_by=uploader.id,
    )
    await session.commit()

    from app.repositories import document_repository

    results = await document_repository.search_project(session, project_id=project.id, query="Acquisition")
    assert document.id in results
