/*
 * F.2.5 Manage Dispatch Orders (first-level function of F.2, Innoslate project 584).
 *   Mechanism: S.1.5 Dispatch Management Subsystem
 *   Inputs : IO.14 Proposed Assignment (internal, from F.2.4); IO.8 Dispatch Acknowledgment (external, from X.3)
 *   Control: IO.6 Dispatch Approval (external, from X.2 Emergency Coordinator)
 *   Outputs: IO.7 Dispatch Order (to X.3); IO.9 Dispatch Status (to X.2)
 *   Satisfies: 1.1.3, 1.1.4, 1.2.4, 1.2.5, 1.3.2, 1.3.3, 2.1.1, 2.4.1, 2.4.2   UC.1 steps: UC.1.11–UC.1.15
 *
 * Decomposed in the second-level IDEF0 into four functions, one module each (same directory):
 *   F.2.5.1 Compile Authorized Dispatch Order   S.1.5.1   f2-5-1-compile-authorized-dispatch-order.js
 *   F.2.5.2 Issue Dispatch Order                S.1.5.2   f2-5-2-issue-dispatch-order.js
 *   F.2.5.3 Verify Dispatch Acknowledgment      S.1.5.3   f2-5-3-verify-dispatch-acknowledgment.js
 *   F.2.5.4 Report Dispatch Status              S.1.5.4   f2-5-4-report-dispatch-status.js
 * This module only carries the internal flows between them, each through an operation of contracts/api-v1.yaml:
 *   F.2.5.1 --IO.15--> F.2.5.2 --IO.16--> F.2.5.3 --IO.17--> F.2.5.4
 * The public functions keep the UC.1 action names so workflow.js, routes.js and the front end are unchanged.
 * Contract operation on F.2.5 itself: acceptProposedAssignment(ProposedAssignment) -> 202 Accepted | 409 Error
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Common = node ? require('./common.js') : root.RescuTechCommon;
  var F251 = node ? require('./f2-5-1-compile-authorized-dispatch-order.js') : root.RescuTechF251;
  var F252 = node ? require('./f2-5-2-issue-dispatch-order.js') : root.RescuTechF252;
  var F253 = node ? require('./f2-5-3-verify-dispatch-acknowledgment.js') : root.RescuTechF253;
  var F254 = node ? require('./f2-5-4-report-dispatch-status.js') : root.RescuTechF254;
  var GuardError = Common.GuardError;

  function create(ctx) {
    var f = { 'F.2.5.1': F251.create(ctx), 'F.2.5.2': F252.create(ctx), 'F.2.5.3': F253.create(ctx), 'F.2.5.4': F254.create(ctx) };
    var orders = {};   // external view of IO.7 plus its acknowledgment time, for the REST layer

    // Every internal flow of F.2.5 crosses a module boundary here: one contract operation, request in, { status, body } out.
    function call(receiver, operationId, request) {
      var response = f[receiver][operationId](request);
      if (ctx.onContractCall) ctx.onContractCall({ receiver: receiver, operationId: operationId, request: request, response: response });
      return response;
    }

    // Contract: acceptProposedAssignment — IO.14 in; held by S.1.5.1 until the approval control arrives
    function acceptProposedAssignment(pa) {
      if (!f['F.2.5.1'].holdProposedAssignment(pa)) {
        return { status: 409, body: { error: 'Proposed assignment ' + pa.recommendationId + ' is already held.', rule: null } };
      }
      return { status: 202, body: { recommendationId: pa.recommendationId, held: true } };
    }

    // UC.1.11 Approve Resource Assignment (control IO.6) — F.2.5.1
    function approveResourceAssignment(recId, coordinatorName) {
      var approval = f['F.2.5.1'].recordApproval(recId, coordinatorName);
      return { id: approval.id, recId: recId, incidentId: approval.incidentId, teamId: approval.teamId, by: approval.by, at: approval.at };
    }

    // UC.1.12 Issue Dispatch Order — F.2.5.1 --IO.15--> F.2.5.2, which sends IO.7 and keeps IO.16
    function issueDispatchOrder(recId) {
      var authorized = call('F.2.5.1', 'compileAuthorizedDispatchOrder', { recommendationId: recId });
      if (authorized.status !== 201) {
        ctx.log('UC.1.12', 'RescuTech', 'Blocked: dispatch order for ' + recId + ' has no coordinator approval.', ['SR.6', 'N.5'], 'block');
        throw new GuardError(authorized.body.rule, authorized.body.error);
      }
      var issued = call('F.2.5.2', 'issueDispatchOrder', authorized.body);
      if (issued.status !== 201) throw new GuardError(issued.body.rule, issued.body.error);
      var o = issued.body.dispatchOrder;
      orders[o.orderId] = { id: o.orderId, recId: recId, incidentId: o.incidentId, teamId: o.teamId, teamName: o.teamName,
                            location: o.location, task: o.task, urgency: o.urgency, approvalId: o.approvalId,
                            issuedAt: o.issuedAt, acknowledgedAt: null };
      return orders[o.orderId];
    }

    // UC.1.13 Acknowledge Dispatch Order (IO.8) -> UC.1.14 Record Dispatch Acknowledgment — F.2.5.3 with IO.16
    function acknowledgeDispatchOrder(orderId, teamId) {
      var verified = call('F.2.5.3', 'verifyDispatchAcknowledgment', {
        dispatchAcknowledgment: { orderId: orderId, teamId: teamId },
        issuedOrderRecord: f['F.2.5.2'].records[orderId] || null
      });
      if (verified.status !== 201) throw new GuardError(verified.body.rule, verified.body.error);
      orders[orderId].acknowledgedAt = verified.body.acknowledgedAt;
      return orders[orderId];
    }

    // UC.1.15 Present Dispatch Status (IO.9) — F.2.5.3 --IO.17--> F.2.5.4
    function presentDispatchStatus(orderId) {
      if (!orders[orderId]) return { code: 'NO_ORDER', label: 'No order issued' };
      var status = call('F.2.5.4', 'reportDispatchStatus', { orderId: orderId, verifiedAcknowledgment: f['F.2.5.3'].verified[orderId] || null });
      return { code: status.body.code, label: status.body.label };
    }

    return { functions: f, proposed: f['F.2.5.1'].proposed, approvals: f['F.2.5.1'].approvals, orders: orders,
             acceptProposedAssignment: acceptProposedAssignment, approveResourceAssignment: approveResourceAssignment,
             issueDispatchOrder: issueDispatchOrder, acknowledgeDispatchOrder: acknowledgeDispatchOrder,
             presentDispatchStatus: presentDispatchStatus };
  }

  var api = { id: 'F.2.5', mechanism: 'S.1.5', create: create };
  if (node) module.exports = api;
  else root.RescuTechF25 = api;
})(this);
