"""Functional requirement tests for F.2.5 Manage Dispatch Orders (SYSEN 5151 PMC2).

One pytest test per requirement, named by its ID: the S.1.5 Component Requirements Document (CRD) in
Innoslate project 584 and the parent system requirements SR.6-SR.9. The product is JavaScript, so each
test runs the matching check in tests/functional-requirements.spec.js through Node against the same REST
routes the front end uses. The second-level function and module that satisfy each requirement are listed in
docs/traceability.md.

Run:  pytest tests/test_functional_requirements.py -v     (CI: .github/workflows/tests.yml)
"""
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = ROOT / "tests" / "functional-requirements.spec.js"


def run_check(requirement_id):
    result = subprocess.run(["node", str(SPEC), requirement_id], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


# --- F.2.5.1 Compile Authorized Dispatch Order - S.1.5.1 Dispatch Authorization Module

def test_CRD_1_1_1_accept_proposed_assignment():
    run_check("CRD 1.1.1")

def test_CRD_1_1_2_accept_dispatch_approval():
    run_check("CRD 1.1.2")

def test_CRD_1_4_1_compile_authorized_dispatch_order():
    run_check("CRD 1.4.1")

def test_CRD_2_1_1_match_order_to_approved_assignment():
    run_check("CRD 2.1.1")

def test_SR_6_no_order_without_coordinator_approval():
    run_check("SR.6")

# --- F.2.5.2 Issue Dispatch Order - S.1.5.2 Order Transmission Module

def test_CRD_1_2_1_provide_dispatch_order_to_rescue_team():
    run_check("CRD 1.2.1")

def test_CRD_1_4_2_issue_one_order_per_authorization():
    run_check("CRD 1.4.2")

def test_SR_8_order_identifies_location_and_task():
    run_check("SR.8")

# --- F.2.5.3 Verify Dispatch Acknowledgment - S.1.5.3 Acknowledgment Verification Module

def test_CRD_1_1_3_accept_dispatch_acknowledgment():
    run_check("CRD 1.1.3")

def test_CRD_1_4_3_verify_acknowledgment_against_issued_order():
    run_check("CRD 1.4.3")

def test_CRD_2_4_1_record_acknowledgment_against_its_order():
    run_check("CRD 2.4.1")

def test_CRD_2_4_2_reject_acknowledgment_from_non_assigned_team():
    run_check("CRD 2.4.2")

def test_SR_9_assigned_team_can_acknowledge():
    run_check("SR.9")

# --- F.2.5.4 Report Dispatch Status - S.1.5.4 Status Reporting Module

def test_CRD_1_2_2_provide_dispatch_status_to_coordinator():
    run_check("CRD 1.2.2")

def test_CRD_1_4_4_report_status_from_verified_acknowledgment():
    run_check("CRD 1.4.4")

def test_SR_7_coordinator_sees_acknowledgment_status():
    run_check("SR.7")

# --- F.2.5 Manage Dispatch Orders - S.1.5 Dispatch Management Subsystem

def test_CRD_2_3_1_no_language_model_in_dispatch_management():
    run_check("CRD 2.3.1")
