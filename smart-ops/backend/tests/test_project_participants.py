import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException
import app.db.base  # Register all related models, as the application does.

from app.api.v1.endpoints.project_participants import create_project_participant
from app.schemas.project_participant import ProjectParticipantCreate


class ParticipantTests(unittest.TestCase):
    def test_user_organization_is_used_when_omitted(self):
        organization_id = uuid.uuid4()
        user = SimpleNamespace(organization_id=organization_id, is_active=True)
        db = Mock()
        db.get.side_effect = [object(), user, object()]
        payload = ProjectParticipantCreate(project_id=uuid.uuid4(), user_id=uuid.uuid4())
        with patch("app.api.v1.endpoints.project_participants.log_activity"):
            participant = create_project_participant(payload, db, SimpleNamespace(id=uuid.uuid4()))
        self.assertEqual(participant.organization_id, organization_id)
        db.commit.assert_called_once()

    def test_missing_organization_and_user_is_rejected_before_save(self):
        db = Mock()
        payload = ProjectParticipantCreate(project_id=uuid.uuid4())
        with self.assertRaises(HTTPException) as error:
            create_project_participant(payload, db, SimpleNamespace(id=uuid.uuid4()))
        self.assertEqual(error.exception.status_code, 400)
        db.add.assert_not_called()

    def test_explicit_organization_is_preserved(self):
        organization_id = uuid.uuid4()
        db = Mock()
        db.get.side_effect = [object(), SimpleNamespace(is_active=True, organization_id=uuid.uuid4()), object()]
        payload = ProjectParticipantCreate(project_id=uuid.uuid4(), user_id=uuid.uuid4(), organization_id=organization_id)
        with patch("app.api.v1.endpoints.project_participants.log_activity"):
            participant = create_project_participant(payload, db, SimpleNamespace(id=uuid.uuid4()))
        self.assertEqual(participant.organization_id, organization_id)
