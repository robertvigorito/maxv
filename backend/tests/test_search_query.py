from fnmatch import translate

from backend.app.services.asset_service import build_search_filter, parse_size_filter


def test_build_search_filter_supports_name_size_and_tag_clauses():
    result = build_search_filter("name:_A* size:4mb> tag:travel")

    assert result["$and"][0]["filename"]["$options"] == "i"
    assert result["$and"][1] == {"size": {"$gt": 4 * 1024 * 1024}}
    assert result["$and"][2]["tags"]["$options"] == "i"


def test_parse_size_filter_accepts_prefix_and_suffix_operators():
    assert parse_size_filter(">=2gb") == {"$gte": 2 * 1024**3}
    assert parse_size_filter("4mb>") == {"$gt": 4 * 1024**2}


def test_plain_text_search_matches_filename():
    result = build_search_filter("holiday 2026")

    assert result == {
        "$and": [
            {"filename": {"$regex": "holiday", "$options": "i"}},
            {"filename": {"$regex": "2026", "$options": "i"}},
        ]
    }


def test_tag_search_supports_repeated_and_comma_separated_tags():
    repeated = build_search_filter("tag:one tag:two")
    comma_separated = build_search_filter("tag:one,two")

    expected = {
        "$and": [
            {"tags": {"$regex": translate("one"), "$options": "i"}},
            {"tags": {"$regex": translate("two"), "$options": "i"}},
        ]
    }
    assert repeated == expected
    assert comma_separated == expected
