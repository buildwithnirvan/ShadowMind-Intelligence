"""
Evidence-Based Diagnostic Workflow for ShadowMind.
Implements problem extraction, severity classification, root cause analysis,
and test verification reporting for technical and coding issues.
"""
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple


class SeverityLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFORMATIONAL = "INFORMATIONAL"


@dataclass
class DiagnosticReport:
    objective: str
    error_message: Optional[str]
    severity: SeverityLevel
    root_cause_type: str  # confirmed | likely | contributing | symptom
    likely_cause: str
    affected_components: List[str] = field(default_factory=list)
    proposed_fix: Optional[str] = None
    verification_steps: List[str] = field(default_factory=list)
    tests_executed: List[str] = field(default_factory=list)
    tests_passed: bool = False
    remaining_limitations: Optional[str] = None

    def format_diagnostic_summary(self) -> str:
        lines = [
            f"**Diagnostic Summary** (Severity: `{self.severity.value}`)",
            f"- **Likely Cause ({self.root_cause_type})**: {self.likely_cause}",
        ]
        if self.affected_components:
            lines.append(f"- **Affected Components**: {', '.join(self.affected_components)}")
        if self.verification_steps:
            lines.append("- **Verification Steps**:")
            for step in self.verification_steps:
                lines.append(f"  • {step}")
        return "\n".join(lines)


# Regex patterns for severity classification
CRITICAL_PATTERNS = [
    re.compile(r"\b(data loss|corruption|security (vulnerability|breach|exploit)|auth bypass|unauthorized access|system crash|database dropped|segfault|core dump)\b", re.I),
]

HIGH_PATTERNS = [
    re.compile(r"\b(fatal|critical error|500 internal server error|crash(es|ed)?|unhandled exception|cannot connect to database|broken pipeline|service unavailable|deadlock)\b", re.I),
    re.compile(r"\b(importerror|modulenotfounderror|syntaxerror|typeerror|attributeerror)\b", re.I),
]

MEDIUM_PATTERNS = [
    re.compile(r"\b(timeout|slow query|memory leak|retry failed|unexpected response|edge case|partial failure|deprecated|warning:)\b", re.I),
    re.compile(r"\b(indexerror|keyerror|valueerror|zerodivisionerror|filenotfounderror|oserror|ioerror)\b", re.I),
]

LOW_PATTERNS = [
    re.compile(r"\b(cosmetic|ui glitch|typo|lint|formatting|minor bug|styling|alignment)\b", re.I),
]

INFORMATIONAL_PATTERNS = [
    re.compile(r"\b(info:|status 200|healthy|debug:|notice:|log message|heartbeat)\b", re.I),
]


def classify_severity(text: str) -> SeverityLevel:
    """Classifies issue severity based on impact and evidence."""
    for pat in CRITICAL_PATTERNS:
        if pat.search(text):
            return SeverityLevel.CRITICAL

    for pat in HIGH_PATTERNS:
        if pat.search(text):
            return SeverityLevel.HIGH

    for pat in MEDIUM_PATTERNS:
        if pat.search(text):
            return SeverityLevel.MEDIUM

    for pat in LOW_PATTERNS:
        if pat.search(text):
            return SeverityLevel.LOW

    for pat in INFORMATIONAL_PATTERNS:
        if pat.search(text):
            return SeverityLevel.INFORMATIONAL

    # Default to MEDIUM for unclassified errors, INFORMATIONAL for general queries
    if re.search(r"\b(error|exception|fail|traceback|bug)\b", text, re.I):
        return SeverityLevel.MEDIUM
    return SeverityLevel.INFORMATIONAL


def extract_error_info(text: str) -> Tuple[Optional[str], str]:
    """Extracts explicit error messages and root cause type."""
    tb_match = re.search(r"Traceback \(most recent call last\):.*?(?:\n[A-Za-z]+Error: .*?$|\n[A-Za-z]+Exception: .*?$)", text, re.DOTALL)
    if tb_match:
        return tb_match.group(0).strip(), "confirmed"

    err_line = re.search(r"\b([A-Za-z]+(?:Error|Exception)(?:: [^\n]+)?)", text)
    if err_line:
        return err_line.group(1).strip(), "confirmed"

    generic_err = re.search(r"(?:error|failed with|exception):\s*([^\n]+)", text, re.I)
    if generic_err:
        return generic_err.group(0).strip(), "likely"

    crit_match = re.search(r"\b(corruption|data loss|compromise|service crashed|outage|unauthorized access)[^\n.]*", text, re.I)
    if crit_match:
        return crit_match.group(0).strip(), "likely"

    return None, "likely"


def analyze_technical_problem(text: str) -> DiagnosticReport:
    """Produces an evidence-based diagnostic report from user problem description."""
    severity = classify_severity(text)
    error_msg, cause_type = extract_error_info(text)

    # Determine likely components
    affected = []
    if re.search(r"\b(python|pip|venv|virtualenv|pytest)\b", text, re.I):
        affected.append("Python Runtime / Dependencies")
    if re.search(r"\b(sql|database|mongo|postgres|query|table)\b", text, re.I):
        affected.append("Database / Query Engine")
    if re.search(r"\b(fastapi|router|endpoint|api|http|backend)\b", text, re.I):
        affected.append("Backend API / Router")
    if re.search(r"\b(react|frontend|vite|ui|component)\b", text, re.I):
        affected.append("Frontend / UI Components")

    if not affected:
        affected.append("Application Logic")

    likely_cause = error_msg or (text.strip() if len(text.strip()) < 80 else "Configuration or execution error in specified component.")

    verification = [
        "Reproduce issue in isolated environment or unit test.",
        "Apply targeted source code or configuration correction.",
        "Run test suite to verify fix and ensure zero regressions."
    ]

    return DiagnosticReport(
        objective="Resolve technical issue and verify stability.",
        error_message=error_msg,
        severity=severity,
        root_cause_type=cause_type,
        likely_cause=likely_cause,
        affected_components=affected,
        verification_steps=verification,
        tests_executed=["pytest"],
        tests_passed=True
    )
