"""Input checks shared by ORBITAL's public functions (Requirements I5, I8).

Internal module: the leading underscore marks it as not part of the public
interface (I6), so it may change freely.
"""

import math
import numbers

import numpy as np
from numpy.typing import ArrayLike, NDArray


def as_vector2(value: ArrayLike, name: str) -> NDArray[np.float64]:
    """Return ``value`` as a new float64 array of shape (2,), or raise ValueError.

    Accepts real numbers in any array-like form (list, tuple or array, of ints
    or floats). Rejects booleans, complex numbers, non-numeric values, any shape
    other than exactly (2,), NaN and infinity. The result is always a fresh
    copy, so a caller's array is never modified or shared.
    """
    array = np.asarray(value)
    if array.dtype.kind not in "iuf":  # signed int, unsigned int, float
        raise ValueError(f"{name} must contain real numbers, got dtype {array.dtype}")
    if array.shape != (2,):
        raise ValueError(f"{name} must have shape (2,), got shape {array.shape}")
    result = array.astype(np.float64)  # astype always returns a copy
    if not np.all(np.isfinite(result)):
        raise ValueError(f"{name} must be finite, got {result}")
    return result


def as_states(value: ArrayLike, name: str) -> NDArray[np.float64]:
    """Return ``value`` as a new float64 array of shape (2,) or (N, 2), or raise ValueError.

    For diagnostics, which accept one state or a whole trajectory (Requirement
    I8a). Shape (2,) is a single vector; shape (N, 2) with N >= 1 is one vector
    per row. Every other shape is rejected explicitly, so NumPy broadcasting is
    never relied on. Same real-number, finiteness and copy rules as as_vector2.
    """
    array = np.asarray(value)
    if array.dtype.kind not in "iuf":
        raise ValueError(f"{name} must contain real numbers, got dtype {array.dtype}")
    is_single = array.shape == (2,)
    is_stack = array.ndim == 2 and array.shape[0] >= 1 and array.shape[1] == 2
    if not (is_single or is_stack):
        raise ValueError(f"{name} must have shape (2,) or (N, 2), got shape {array.shape}")
    result = array.astype(np.float64)
    if not np.all(np.isfinite(result)):
        raise ValueError(f"{name} must be finite")
    return result


def as_positive_int(value: int, name: str) -> int:
    """Return ``value`` as a Python int that is >= 1, or raise ValueError.

    Accepts Python and NumPy integers. Rejects booleans, floats (even 3.0) and
    strings, so a step count is never silently truncated or misread.
    """
    if isinstance(value, bool) or not isinstance(value, numbers.Integral):
        raise ValueError(f"{name} must be an integer, got {value!r}")
    result = int(value)
    if result < 1:
        raise ValueError(f"{name} must be >= 1, got {result}")
    return result


def as_positive_scalar(value: float, name: str) -> float:
    """Return ``value`` as a Python float that is finite and > 0, or raise ValueError.

    Rejects booleans explicitly: in Python, True is an int equal to 1.
    """
    if isinstance(value, bool) or not isinstance(value, numbers.Real):
        raise ValueError(f"{name} must be a real number, got {value!r}")
    result = float(value)
    if not math.isfinite(result) or result <= 0.0:
        raise ValueError(f"{name} must be finite and > 0, got {result}")
    return result
