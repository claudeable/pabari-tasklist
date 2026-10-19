import unittest
import uuid
from datetime import datetime, date, timezone
from enum import Enum
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock
from zipfile import ZipFile
from xml.etree import ElementTree

import app.db.base
from fastapi import HTTPException
from app.api.v1.endpoints.reports import project_updates_report
from app.core.report_export import build_xlsx


class ReportsTests(unittest.TestCase):
    def fixture(self):
        db = Mock()
        pid = uuid.uuid4()
        project = SimpleNamespace(id=pid, name="Naivasha & Water", status=SimpleNamespace(value="active"))
        now = datetime(2026, 10, 19, 9, tzinfo=timezone.utc)
        update = SimpleNamespace(id=uuid.uuid4(), project_id=pid, posted_at=now,
            body="Progress <completed>", status="open", user=SimpleNamespace(full_name="Test user"),
            current_capacity="Capacity", project_requirement="Requirement", internal_notes="Note",
            action_items="Remark", comments=[SimpleNamespace(user=SimpleNamespace(full_name="Commenter"), body="A comment", created_at=now)])
        projects_query = Mock()
        projects_query.filter.return_value = projects_query
        projects_query.order_by.return_value.all.return_value = [project]
        updates_query = Mock()
        updates_query.options.return_value = updates_query
        updates_query.filter.return_value = updates_query
        updates_query.order_by.return_value.all.return_value = [update]
        db.query.side_effect = [projects_query, updates_query]
        return db, pid, projects_query, updates_query

    def test_report_groups_full_update_details_and_comments(self):
        db, pid, _, _ = self.fixture()
        report = project_updates_report(db=db)
        self.assertEqual(report["update_count"], 1)
        self.assertEqual(report["projects"][0]["id"], str(pid))
        update = report["projects"][0]["updates"][0]
        self.assertEqual(update["comments"][0]["body"], "A comment")
        self.assertEqual(update["action_items"], "Remark")

    def test_filters_are_applied_to_query(self):
        db, pid, projects, updates = self.fixture()
        project_updates_report(project_id=pid, start_date=date(2026,10,1), end_date=date(2026,10,19), status="open", db=db)
        self.assertEqual(projects.filter.call_count, 1)
        self.assertEqual(updates.filter.call_count, 4)

    def test_invalid_dates_rejected_before_query(self):
        db = Mock()
        with self.assertRaises(HTTPException) as error:
            project_updates_report(start_date=date(2026,10,20), end_date=date(2026,10,1), db=db)
        self.assertEqual(error.exception.status_code, 400)
        db.query.assert_not_called()

    def test_export_contains_full_comment_and_remark(self):
        db, _, _, _ = self.fixture()
        response = project_updates_report(export="xlsx", db=db)
        with ZipFile(BytesIO(response.body)) as archive:
            sheet = archive.read("xl/worksheets/sheet1.xml").decode()
            self.assertIn("A comment", sheet)
            self.assertIn("Remark", sheet)
            self.assertIn("Naivasha &amp; Water", sheet)
            for name in archive.namelist():
                ElementTree.fromstring(archive.read(name))

    def test_excel_preserves_untrusted_input_as_text(self):
        with ZipFile(BytesIO(build_xlsx([["Header"], ['=HYPERLINK("test")\x00 & <test>']]))) as archive:
            sheet = ElementTree.fromstring(archive.read("xl/worksheets/sheet1.xml"))
            ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            self.assertFalse(sheet.findall(".//x:f", ns))
            self.assertIn('=HYPERLINK("test") & <test>', ''.join(sheet.itertext()))

    def test_empty_project_is_included(self):
        db, _, _, updates = self.fixture()
        updates.order_by.return_value.all.return_value = []
        report = project_updates_report(db=db)
        self.assertEqual(report["update_count"], 0)
        self.assertEqual(len(report["projects"]), 1)
        self.assertEqual(report["projects"][0]["updates"], [])

    def test_excel_does_not_truncate_long_comments(self):
        content = "Long comment " * 4000
        with ZipFile(BytesIO(build_xlsx([["Comment"], [content]]))) as archive:
            sheet = ElementTree.fromstring(archive.read("xl/worksheets/sheet1.xml"))
            ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            cells = [element.text or "" for element in sheet.findall(".//x:t", ns)][1:]
            self.assertEqual(''.join(cells), content)
            self.assertTrue(all(len(cell) <= 32767 for cell in cells))
