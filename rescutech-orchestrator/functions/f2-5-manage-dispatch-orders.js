/*
 * F.2.5 Manage Dispatch Orders (first-level function of F.2, Innoslate project 584).
 *   Inputs : IO.14 Proposed Assignment (internal, from F.2.4); IO.8 Dispatch Acknowledgment (external, from F.4)
 *   Control: IO.6 Dispatch Approval (external, from F.3 Emergency Coordinator)
 *   Outputs: IO.7 Dispatch Order (to F.4); IO.9 Dispatch Status (to F.3)
 *   Satisfies: 1.1.3, 1.1.4, 1.2.4, 1.2.5, 1.3.2, 1.3.3, 2.1.1, 2.4.1, 2.4.2   UC.1 steps: UC.1.10–UC.1.14
 * Contract operation (contracts/api-v1.yaml):
 *   acceptProposedAssignment(ProposedAssignment) -> 202 Accepted | 409 Error
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Common = node ? require('./common.js') : root.RescuTechCommon;
  var GuardError = Common.GuardError;

  function create(ctx) {
    var proposed = {}, approvals = {}, orders = {};

    // Contract: acceptProposedAssignment — IO.14 in; held until the approval control arrives
    function acceptProposedAssignment(pa) {
      if (proposed[pa.recommendationId]) {
        return { status: 409, body: { error: 'Proposed assignment ' + pa.recommendationId + ' is already held.', rule: null } };
      }
      proposed[pa.recommendationId] = pa;
      return { status: 202, body: { recommendationId: pa.recommendationId, held: true } };
    }

    // UC.1.10 Approve Resource Assignment (X.2, control IO.6) — SR.6 / N.5, 1.1.3
    function approveResourceAssignment(recId, coordinatorName) {
      var pa = proposed[recId];
      if (!pa) throw new GuardError('SR.6', 'There is no recommended team to approve.');
      var id = ctx.nextId('AP');
      var approval = { id: id, recId: recId, incidentId: pa.incidentId, teamId: pa.teamId,
                       by: coordinatorName || 'Emergency Coordinator', at: ctx.now() };
      approvals[recId] = approval;
      ctx.log('UC.1.10', 'Coordinator', approval.by + ' approved ' + pa.teamName + ' for ' + pa.incidentId + ' (' + id + ').', ['SR.6', 'N.5']);
      return approval;
    }

    // UC.1.11 Issue Dispatch Order (IO.7) — SR.6, SR.8 / N.5, N.7; 2.1.1
    // GUARD: an order is issued only for the assignment the coordinator approved.
    function issueDispatchOrder(recId) {
      var pa = proposed[recId];
      var approval = approvals[recId];
      if (!pa || !approval || approval.teamId !== pa.teamId) {
        ctx.log('UC.1.11', 'RescuTech', 'Blocked: dispatch order for ' + recId + ' has no coordinator approval.', ['SR.6', 'N.5'], 'block');
        throw new GuardError('SR.6', 'Dispatch blocked. The Emergency Coordinator has not approved this assignment (SR.6).');
      }
      var id = ctx.nextId('DO');
      var order = {
        id: id, recId: recId, incidentId: pa.incidentId, teamId: pa.teamId, teamName: pa.teamName,
        location: pa.location, task: pa.task, urgency: pa.urgency,
        approvalId: approval.id, issuedAt: ctx.now(), acknowledgedAt: null
      };
      orders[id] = order;
      ctx.log('UC.1.11', 'RescuTech', 'Dispatch order ' + id + ' sent to ' + order.teamName + ' (location and task included).', ['SR.6', 'SR.8', 'N.7']);
      return order;
    }

    // UC.1.12 Acknowledge Dispatch Order (IO.8) -> UC.1.13 Record Dispatch Acknowledgment — SR.9 / N.6; 2.4.1, 2.4.2
    function acknowledgeDispatchOrder(orderId, teamId) {
      var order = orders[orderId];
      if (!order) throw new GuardError('SR.9', 'Unknown dispatch order ' + orderId + '.');
      if (order.teamId !== teamId) {
        ctx.log('UC.1.12', 'Rescue Team', 'Rejected: acknowledgment from ' + teamId + ' does not match the assigned team.', ['SR.9'], 'block');
        throw new GuardError('SR.9', 'This order is assigned to a different team.');
      }
      ctx.log('UC.1.12', 'Rescue Team', order.teamName + ' acknowledged receipt of ' + orderId + '.', ['SR.9', 'N.6']);
      order.acknowledgedAt = ctx.now();
      ctx.log('UC.1.13', 'RescuTech', 'Acknowledgment recorded against ' + orderId + '.', ['SR.9']);
      return order;
    }

    // UC.1.14 Present Dispatch Status (IO.9) — SR.7 / N.6. Derived only from recorded events.
    function presentDispatchStatus(orderId) {
      var order = orders[orderId];
      if (!order) return { code: 'NO_ORDER', label: 'No order issued' };
      return order.acknowledgedAt
        ? { code: 'ACKNOWLEDGED', label: 'Acknowledged by ' + order.teamName }
        : { code: 'AWAITING_ACK', label: 'Issued, awaiting acknowledgment' };
    }

    return { proposed: proposed, approvals: approvals, orders: orders,
             acceptProposedAssignment: acceptProposedAssignment, approveResourceAssignment: approveResourceAssignment,
             issueDispatchOrder: issueDispatchOrder, acknowledgeDispatchOrder: acknowledgeDispatchOrder,
             presentDispatchStatus: presentDispatchStatus };
  }

  var api = { id: 'F.2.5', create: create };
  if (node) module.exports = api;
  else root.RescuTechF25 = api;
})(this);
