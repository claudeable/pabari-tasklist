import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException
import app.db.base
from app.core.update_permissions import can_moderate_updates
from app.api.v1.endpoints import project_updates as endpoints
from app.schemas.project_update import ProjectUpdateEdit, ProjectUpdateCommentCreate


def user(email="member@example.com", role="Member"):
    return SimpleNamespace(id=uuid.uuid4(), email=email,
                           role=SimpleNamespace(name=role, permissions=[]))


class UpdatePermissionTests(unittest.TestCase):
    def test_only_harshil_and_admins_can_moderate(self):
        self.assertTrue(can_moderate_updates(user("HKOTECHA@kwale-group.com")))
        self.assertTrue(can_moderate_updates(user(role="Admin")))
        self.assertFalse(can_moderate_updates(user("pmureithi@usm.co.ke")))
        self.assertFalse(can_moderate_updates(user(role="Non-admin")))

    def test_ordinary_users_rejected_before_database_changes(self):
        for endpoint in [endpoints.edit_project_update, endpoints.set_project_update_status,
                         endpoints.delete_project_update, endpoints.edit_project_update_comment,
                         endpoints.delete_project_update_comment, endpoints.delete_project_update_attachment]:
            db = Mock()
            args = dict(db=db, current_user=user())
            if endpoint == endpoints.delete_project_update_attachment:
                args["attachment_id"] = uuid.uuid4()
            else:
                args.update(project_id=uuid.uuid4(), update_id=uuid.uuid4())
                if "comment" in endpoint.__name__:
                    args["comment_id"] = uuid.uuid4()
            if endpoint in [endpoints.edit_project_update, endpoints.set_project_update_status]:
                args["payload"] = ProjectUpdateEdit(body="Edited")
            if endpoint == endpoints.edit_project_update_comment:
                args["payload"] = ProjectUpdateCommentCreate(body="Edited")
            with self.subTest(endpoint=endpoint.__name__), self.assertRaises(HTTPException) as error:
                endpoint(**args)
            self.assertEqual(error.exception.status_code, 403)
            db.get.assert_not_called()
            db.commit.assert_not_called()

    def test_admin_cannot_edit_comment_in_another_project(self):
        db = Mock()
        db.get.side_effect = [SimpleNamespace(project_id=uuid.uuid4()), Mock()]
        with self.assertRaises(HTTPException) as error:
            endpoints.edit_project_update_comment(uuid.uuid4(), uuid.uuid4(), uuid.uuid4(),
                ProjectUpdateCommentCreate(body="Edited"), db, user(role="Admin"))
        self.assertEqual(error.exception.status_code, 404)
        db.commit.assert_not_called()
