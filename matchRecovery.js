/** Recover BO3 lifecycle after tab termination, browser reload or lost sessionStorage.
 * Never simulate a victory, loss, shot, repair or economic settlement.
 * A truly interrupted live round becomes a DNF; an intermission can resume in pit. */
import { beginSortieAssignment, clearSortieAssignment, loadSortieAssignment } from './sortieAssignment.js';
import { clearSeries, loadSeries } from './series.js';
import { recordCombatMatch } from './combatRecords.js';

const deployedMatches = (series,assignment) =>
    !!series && series.phase==='round_active' && assignment?.phase==='deployed' &&
    assignment.id===series.currentAssignmentId &&
    assignment.rigId===series.currentRigId && assignment.contractId===series.contractId;

export function retireUnfinishedMatch(localStorage,sessionStorage,reason='PLAYER RETIRED') {
    const series=loadSeries(localStorage);
    if (!series || series.phase==='complete') {
        if (series?.phase==='complete') clearSeries(localStorage);
        return {action:'none'};
    }
    const saved=recordCombatMatch(localStorage,{
        id:series.id,contractId:series.contractId,outcome:'DNF',
        reason,playerWins:series.playerWins,enemyWins:series.enemyWins,
        rounds:series.rounds.length,rigs:series.participatingRigIds,
    });
    // A faulty records sidecar may lose a stat, but must never strand the save.
    clearSeries(localStorage);
    // Do not discard a fresh, independently staged job just because an older
    // contract's browser session disappeared. Committed assignments are stale.
    const assignment=loadSortieAssignment(sessionStorage);
    if (assignment?.phase!=='pending') clearSortieAssignment(sessionStorage);
    return {action:'retired',recorded:saved.ok,series};
}
export function reconcileMatchOnBoot(localStorage,sessionStorage) {
    const series=loadSeries(localStorage);
    const assignment=loadSortieAssignment(sessionStorage);
    if(!series)return {action:'none'};
    if(series.phase==='complete'){
        // A reload after the terminal result should never hold old contract locks.
        clearSeries(localStorage);
        if(assignment?.phase!=='pending')clearSortieAssignment(sessionStorage);
        return {action:'completed-cleanup'};
    }
    if(series.phase==='round_active'){
        if(deployedMatches(series,assignment))return {action:'resume',series};
        // A new tab/browser session has no committed identity: cannot claim the old
        // physical combat state, so retire as DNF rather than fabricate a defeat.
        return retireUnfinishedMatch(localStorage,sessionStorage,'INTERRUPTED · SESSION LOST');
    }
    if(series.phase==='intermission'){
        if(assignment?.contractId===series.contractId){
            if(assignment.phase==='pending')return {action:'pit',series};
            // A fresh round launch crosses a full-page reload. The q.1 adapter
            // has already moved it to launching/deployed before this boot
            // reconciler runs; wiping it here restages the pit indefinitely.
            // The previous round's assignment, however, is stale and must
            // never be replayed as another combat round.
            const lastRoundAssignmentId=series.rounds[series.rounds.length-1]?.assignmentId;
            if(['launching','deployed'].includes(assignment.phase) &&
                assignment.rigId && assignment.id!==lastRoundAssignmentId)
                return {action:'round-committing',series};
        }
        const staged=beginSortieAssignment(sessionStorage,series.contractId);
        if(staged.ok)return {action:'pit-restored',series};
        return retireUnfinishedMatch(localStorage,sessionStorage,'INTERRUPTED · PIT SESSION UNAVAILABLE');
    }
    return {action:'none'};
}
