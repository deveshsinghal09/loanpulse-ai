class LoanPulseMLError(Exception):
    """Base error for the ML engine."""


class ConfigurationError(LoanPulseMLError):
    """Configuration is incomplete or internally inconsistent."""


class SchemaAmbiguityError(LoanPulseMLError):
    """A required schema role cannot be inferred safely."""


class MissingColumnsError(LoanPulseMLError):
    """Inference or training data is missing required columns."""


class TemporalBoundaryError(LoanPulseMLError):
    """A temporal source contains information after prediction time."""


class ValidationError(LoanPulseMLError):
    """The requested validation split is not statistically usable."""

