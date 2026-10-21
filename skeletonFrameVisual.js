/** U-2 Skeleton -- real long rails, intentionally empty load paths. */
import {frameRoot,finishFrameVisual,socket,groupAt,blockAt,chamfer,bearing,beam,contact} from './frameVisualKit.js';
export function buildSkeletonFrameVisual(fixture){
    const r=frameRoot(fixture,'open longitudinal ladder and truss');
    const mobility=socket(fixture,'mobility'),command=socket(fixture,'command'),
        power=socket(fixture,'power'),combat=socket(fixture,'combat');
    const rails=groupAt(r,'SKELETON / CONTINUOUS UPPER RAILS');
    for(const side of [-1,1]){
        chamfer(rails,(side<0?'left':'right')+' full-length ochre spine',
            [side*.63,.24,.035],[.175,.22,1.38],'ochre',.16);
    }
    const crosses=groupAt(r,'SKELETON / TRANSVERSE TIES');
    for(const [label,z] of [['front',-.51],['middle',.01],['rear',.56]])
        blockAt(crosses,label+' steel crossmember',[0,.20,z],[1.43,.13,.135],'iron');
    const triangulation=groupAt(r,'SKELETON / OPEN SIDE TRUSSES');
    for(const side of [-1,1]){
        const x=side*.63;
        blockAt(triangulation,(side<0?'left':'right')+' rust front upright',
            [x,-.07,-.47],[.12,.50,.15],'rust');
        beam(triangulation,(side<0?'left':'right')+' forward diagonal',
            [x,.16,-.48],[x,-.35,.19],.12,.14,'iron');
        beam(triangulation,(side<0?'left':'right')+' rear diagonal',
            [x,-.34,.17],[x,.17,.55],.12,.14,'loadSteel');
        blockAt(triangulation,(side<0?'left':'right')+' exposed lower runner',
            [x,-.37,.025],[.13,.14,1.18],'raw');
    }
    const lower=groupAt(r,'SKELETON / LOWER PAIRED-MOBILITY SADDLE');
    blockAt(lower,'lower transversal drive saddle',[0,-.45,.005],[1.42,.17,.33],'iron');
    beam(lower,'single U1 mobility drawbar',[0,-.45,mobility[2]],
        [mobility[0],mobility[1]+.06,mobility[2]],.24,.28,'iron');
    contact(lower,'single U1 paired leg input',
        [mobility[0],mobility[1]+.035,mobility[2]],.22,.07);
    const tops=groupAt(r,'SKELETON / RAISED CAB BRIDGE');
    blockAt(tops,'shallow command crossing',[0,.095,command[2]],[.78,.095,.40],'iron');
    blockAt(tops,'command contact landing',[0,.159,command[2]],[.30,.033,.29],'bright');
    for(const side of [-1,1])
        beam(tops,(side<0?'left':'right')+' deck diagonal support',
            [side*.63,.24,-.49],[side*.29,.08,command[2]],.11,.12,'iron');
    const weapon=groupAt(r,'SKELETON / RIGHT WEAPON OUTRIGGER');
    beam(weapon,'lateral combat cantilever',[.63,.19,-.48],
        [combat[0]-.09,combat[1],combat[2]],.19,.22,'raw');
    beam(weapon,'triangular outrigger stay',[.63,-.24,-.29],
        [combat[0]-.14,combat[1],combat[2]+.09],.12,.14,'iron');
    bearing(weapon,'right compact bearing',[combat[0]-.08,combat[1],combat[2]],
        .19,.17,'iron','x',10);
    contact(weapon,'weapon U1 landing',[combat[0]-.013,combat[1],combat[2]],
        .13,.05,'x');
    const rear=groupAt(r,'SKELETON / REAR OPEN GENERATOR PLATFORM');
    blockAt(rear,'cross-rail power platform',[power[0],power[1]-.15,.57],
        [.76,.13,.27],'iron');
    beam(rear,'power deck short bearer',[0,.19,.40],[0,power[1]-.09,.58],.20,.17,'bright');
    blockAt(rear,'teal side service box',[-.67,.04,.26],[.20,.30,.43],'teal');
    return finishFrameVisual(r,fixture);
}
