import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import BackgroundTasks
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.project_emails import queue_project_email


class ProjectEmailTests(unittest.TestCase):
    def test_recipient_deduplication_and_html_escaping(self):
        db = Mock()
        db.info = {"background_tasks": BackgroundTasks()}
        db.get.side_effect = [SimpleNamespace(name="Water <works>"), SimpleNamespace(full_name="A & B")]
        db.query.return_value.join.return_value.filter.return_value.all.return_value = [
            ("TEAM@example.com",), ("team@example.com",), ("",),
        ]
        queue_project_email(db, project_id=1, user_id=2, description="Posted <script>")
        messages = db.info["project_emails"]
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0][0], "team@example.com")
        self.assertIn("Water &lt;works&gt;", messages[0][2])
        self.assertIn("Posted &lt;script&gt;", messages[0][2])

    def test_commit_schedules_email_and_rollback_discards_it(self):
        with Session(create_engine("sqlite://")) as db:
            tasks = BackgroundTasks()
            db.info["background_tasks"] = tasks
            db.execute(text("SELECT 1"))
            db.info["project_emails"] = [("team@example.com", "Subject", "Body")]
            self.assertEqual(len(tasks.tasks), 0)
            db.rollback()
            self.assertEqual(len(tasks.tasks), 0)
            self.assertNotIn("project_emails", db.info)
            db.execute(text("SELECT 1"))
            db.info["project_emails"] = [("team@example.com", "Subject", "Body")]
            with patch("app.core.project_emails.send_notification_email") as send:
                db.commit()
                self.assertEqual(len(tasks.tasks), 1)
                asyncio.run(tasks())
                send.assert_called_once_with("team@example.com", "Subject", "Body")


if __name__ == "__main__":
    unittest.main()
