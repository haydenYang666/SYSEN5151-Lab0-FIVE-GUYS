/*
 * F.2.5.1 Compile Authorized Dispatch Order — second-level function of F.2.5 Manage Dispatch Orders
 * (Innoslate project 584, second-level IDEF0 of F.2.5).
 *   Mechanism : S.1.5.1 Dispatch Authorization Module
 *   Input     : IO.14 Proposed Assignment (held from the moment F.2.5 receives it)
 *   Control   : IO.6 Dispatch Approval (external, from X.2 Emergency Coordinator over C.2)
 *   Output    : IO.15 Authorized Dispatch Order (internal, to F.2.5.2 over C.9)
 *   Requirements: CRD 1.1.1, 1.1.2, 1.3.1, 1.3.2, 1.4.1, 2.1.1, 2.4.3 · SR.6   UC.1 step: UC.1.11
 * Contract operation (contracts/api-v1.yaml):
 *   compileAuthorizedDispatchOrder(AuthorizationRequest) -> 201 AuthorizedDispatchOrder | 409 Error
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Common = node ? require('./common.js') : root.RescuTechCommon;
  var GuardError = Common.GuardError;

  /**
   * ICOM signature of F.2.5.1.
   * @param {ProposedAssignment} proposedAssignment  I  IO.14
   * @param {DispatchApproval}   dispatchApproval    C  IO.6
   * @returns {AuthorizedDispatchOrder|null}          O  IO.15 — null when the control does not authorize this assignment
   */
  function compile(proposedAssignment, dispatchApproval) {
    if (!proposedAssignment || !dispatchApproval) return null;
    if (dispatchApproval.recommendationId !== proposedAssignment.recommendationId) return null;   // CRD 2.1.1
    if (dispatchApproval.teamId !== proposedAssignment.teamId) return null;                       // CRD 2.1.1
    return {
      recommendationId: proposedAssignment.recommendationId, incidentId: proposedAssignment.incidentId,
      teamId: proposedAssignment.teamId, teamName: proposedAssignment.teamName,
      location: proposedAssignment.location, task: proposedAssignment.task, urgency: proposedAssignment.urgency,
      approvalId: dispatchApproval.id, approvedBy: dispatchApproval.by, approvedAt: dispatchApproval.at
    };
  }

  function create(ctx) {
    var proposed = {}, approvals = {};

    // IO.14 arrives at the F.2.5 boundary (contract acceptProposedAssignment); S.1.5.1 holds it.  CRD 1.1.1
    function holdProposedAssignment(pa) {
      if (proposed[pa.recommendationId]) return false;
      proposed[pa.recommendationId] = pa;
      return true;
    }

    // UC.1.11 Approve Resource Assignment — the control IO.6 arrives from the Emergency Coordinator.  CRD 1.1.2 · SR.6
    function recordApproval(recId, coordinatorName) {
      var pa = proposed[recId];
      if (!pa) throw new GuardError('SR.6', 'There is no recommended team to approve.');
      var approval = { id: ctx.nextId('AP'), recommendationId: recId, incidentId: pa.incidentId, teamId: pa.teamId,
                       by: coordinatorName || 'Emergency Coordinator', at: Common.iso(ctx.now()) };
      approvals[recId] = approval;
      ctx.log('UC.1.11', 'Coordinator', approval.by + ' approved ' + pa.teamName + ' for ' + pa.incidentId + ' (' + approval.id + ').', ['SR.6', 'N.5']);
      return approval;
    }

    // Contract: compileAuthorizedDispatchOrder — IO.15 out.  CRD 1.4.1, 2.1.1
    function compileAuthorizedDispatchOrder(request) {
      var order = compile(proposed[request.recommendationId], approvals[request.recommendationId]);
      if (!order) {
        return { status: 409, body: { error: 'Dispatch blocked. The Emergency Coordinator has not approved this assignment (SR.6).', rule: 'SR.6' } };
      }
      return { status: 201, body: order };
    }

    return { proposed: proposed, approvals: approvals, holdProposedAssignment: holdProposedAssignment,
             recordApproval: recordApproval, compileAuthorizedDispatchOrder: compileAuthorizedDispatchOrder };
  }

  var api = { id: 'F.2.5.1', mechanism: 'S.1.5.1', create: create, compile: compile };
  if (node) module.exports = api;
  else root.RescuTechF251 = api;
})(this);
