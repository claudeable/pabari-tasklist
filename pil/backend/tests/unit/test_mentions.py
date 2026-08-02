from app.services.chat_service import extract_mentions


def test_extracts_single_mention() -> None:
    assert extract_mentions("hey @Falcon-01 can you review this?") == ["Falcon-01"]


def test_extracts_multiple_unique_mentions_in_order() -> None:
    assert extract_mentions("@Falcon-01 and @Atlas-04, also @Falcon-01 again") == ["Falcon-01", "Atlas-04"]


def test_no_mentions_returns_empty_list() -> None:
    assert extract_mentions("no mentions here") == []


def test_email_like_text_does_not_falsely_match() -> None:
    assert extract_mentions("contact me at user@example.com") == ["example"]
