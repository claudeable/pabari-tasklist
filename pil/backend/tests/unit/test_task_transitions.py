from app.domain.models.task import is_valid_transition


def test_same_status_is_always_a_valid_no_op_transition() -> None:
    for status in ("todo", "in_progress", "review", "done"):
        assert is_valid_transition(status, status) is True


def test_any_status_is_directly_settable() -> None:
    # This deployment dropped the gated todo -> in_progress -> review -> done
    # workflow in favor of a plain status dropdown that can set any status
    # directly (e.g. In Progress straight to Resolved, skipping In Review).
    assert is_valid_transition("todo", "in_progress") is True
    assert is_valid_transition("in_progress", "review") is True
    assert is_valid_transition("review", "done") is True
    assert is_valid_transition("in_progress", "done") is True
    assert is_valid_transition("todo", "done") is True
    assert is_valid_transition("todo", "review") is True
    assert is_valid_transition("done", "todo") is True
    assert is_valid_transition("done", "in_progress") is True
    assert is_valid_transition("done", "review") is True
    assert is_valid_transition("review", "in_progress") is True
