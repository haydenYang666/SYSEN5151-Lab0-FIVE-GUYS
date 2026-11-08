/*
 * F.2.5.2 Issue Dispatch Order — second-level function of F.2.5 Manage Dispatch Orders
 * (Innoslate project 584, second-level IDEF0 of F.2.5).
 *   Mechanism : S.1.5.2 Order Transmission Module
 *   Input     : IO.15 Authorized Dispatch Order (internal, from F.2.5.1 over C.9)
 *   Outputs   : IO.7 Dispatch Order (external, to X.3 Rescue Team over C.3)
 *               IO.16 Issued Order Record (internal, to F.2.5.3 over C.10)
 *   Requirements: CRD 1.2.1, 1.3.3, 1.4.2, 2.3.1 · SR.6, SR.8   UC.1 step: UC.1.12
 * Contract operation (contracts/api-v1.yaml):
 *   issueDispatchOrder(AuthorizedDispatchOrder) -> 201 IssueResult | 409 Error
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Common = node ? require('./common.js') : root.RescuTechCommon;

  /**
   * ICOM signature of F.2.5.2.
   * @param {AuthorizedDispatchOrder} authorizedDispatchOrder  I  IO.15
   * @param {string} orderId   identifier assigned by S.1.5.2
   * @param {string} issuedAt  time of issue
   * @returns {{dispatchOrder: DispatchOrder, issuedOrderRecord: IssuedOrderRecord}}  O  IO.7, IO.16
   */
  function issue(authorizedDispatchOrder, orderId, issuedAt) {
    var a = authorizedDispatchOrder;
    return {
      dispatchOrder: { orderId: orderId, incidentId: a.incidentId, teamId: a.teamId, teamName: a.teamName,
                       location: a.location, task: a.task, urgency: a.urgency, approvalId: a.approvalId, issuedAt: issuedAt },
      issuedOrderRecord: { orderId: orderId, recommendationId: a.recommendationId, incidentId: a.incidentId,
                           teamId: a.teamId, teamName: a.teamName, approvalId: a.approvalId, issuedAt: issuedAt }
    };
  }

  function create(ctx) {
    var records = {}, byRecommendation = {};

    // Contract: issueDispatchOrder — IO.15 in; IO.7 (external) and IO.16 out.  CRD 1.2.1, 1.4.2 · SR.8
    function issueDispatchOrder(authorizedDispatchOrder) {
      if (byRecommendation[authorizedDispatchOrder.recommendationId]) {                       // CRD 1.4.2: one order per authorization
        return { status: 409, body: { error: 'A dispatch order was already issued for ' + authorizedDispatchOrder.recommendationId + '.', rule: '1.4.2' } };
      }
      var out = issue(authorizedDispatchOrder, ctx.nextId('DO'), Common.iso(ctx.now()));
      records[out.issuedOrderRecord.orderId] = out.issuedOrderRecord;
      byRecommendation[authorizedDispatchOrder.recommendationId] = out.issuedOrderRecord.orderId;
      ctx.log('UC.1.12', 'RescuTech', 'Dispatch order ' + out.dispatchOrder.orderId + ' sent to ' + out.dispatchOrder.teamName +
              ' (location and task included).', ['SR.6', 'SR.8', 'N.7']);
      return { status: 201, body: out };
    }

    return { records: records, issueDispatchOrder: issueDispatchOrder };
  }

  var api = { id: 'F.2.5.2', mechanism: 'S.1.5.2', create: create, issue: issue };
  if (node) module.exports = api;
  else root.RescuTechF252 = api;
})(this);
