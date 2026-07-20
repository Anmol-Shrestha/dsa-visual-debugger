"""Tests for the JSON-safe serializer (ADR-002)."""

import json
import math

from services.serialization import MAX_ITEMS, serialize_value


class Node:
    def __init__(self, val, nxt=None):
        self.val = val
        self.next = nxt


def is_json_safe(value) -> bool:
    try:
        json.dumps(value)
        return True
    except (TypeError, ValueError):
        return False


def test_primitives_pass_through():
    assert serialize_value(42) == 42
    assert serialize_value("hi") == "hi"
    assert serialize_value(True) is True
    assert serialize_value(None) is None
    assert serialize_value(3.5) == 3.5


def test_nan_and_inf_become_strings():
    assert serialize_value(math.nan) == "nan"
    assert serialize_value(math.inf) == "inf"


def test_tuple_and_set_are_tagged():
    assert serialize_value((1, 2)) == {"__type__": "tuple", "items": [1, 2]}
    assert serialize_value({3, 1, 2}) == {"__type__": "set", "items": [1, 2, 3]}


def test_dict_keys_coerced_to_strings():
    assert serialize_value({1: "a", (2, 3): "b"}) == {"1": "a", "(2, 3)": "b"}


def test_custom_object_tagged_with_attrs():
    node = Node(5)
    assert serialize_value(node) == {
        "__type__": "Node",
        "attrs": {"val": 5, "next": None},
    }


def test_cycle_detection():
    a = Node(1)
    b = Node(2, a)
    a.next = b
    result = serialize_value(a)
    assert result["attrs"]["next"]["attrs"]["next"] == {"__cycle__": "Node"}
    assert is_json_safe(result)


def test_shared_acyclic_references_still_render():
    shared = [1, 2]
    result = serialize_value([shared, shared])
    assert result == [[1, 2], [1, 2]]


def test_large_list_truncated():
    result = serialize_value(list(range(MAX_ITEMS + 50)))
    assert len(result) == MAX_ITEMS + 1
    assert result[-1] == {"__truncated__": True}


def test_deep_nesting_truncated():
    nested = [1]
    for _ in range(30):
        nested = [nested]
    assert is_json_safe(serialize_value(nested))
    assert "__truncated__" in json.dumps(serialize_value(nested))


def test_unserializable_degrades_to_repr_never_raises():
    result = serialize_value(open.__call__)
    assert isinstance(result, str)
    gen = (x for x in range(3))
    assert isinstance(serialize_value(gen), str)
