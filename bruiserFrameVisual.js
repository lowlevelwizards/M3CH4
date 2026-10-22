/** SR-01 Bruiser -- dense welded core and broad shoulder/trunnion load path. */
import {frameRoot,finishFrameVisual,socket,groupAt,blockAt,chamfer,bearing,beam,contact} from './frameVisualKit.js';
export function buildBruiserFrameVisual(fixture){
    const r=frameRoot(fixture,'heavy welded central frame');
    const mobility=socket(fixture,'mobility'),command=socket(fixture,'command'),
        power=socket(fixture,'power'),combat=socket(fixture,'combat');
    const core=groupAt(r,'BRUISER / WELDED CORE');
    chamfer(core,'main dark welded frame',[0,-.045,.055],[1.08,.58,.94],'iron',.10);
    chamfer(core,'cream front central sacrificial shield',[0,-.045,-.477],
        [.62,.56,.16],'cream',.14);
    blockAt(core,'front-to-belly steel rib',[0,-.35,-.33],[.42,.32,.37],'loadSteel');
    const shoulder=groupAt(r,'BRUISER / TRANSVERSE SHOULDERS');
    blockAt(shoulder,'continuous mustard shoulder girder',[0,.22,.015],[1.53,.25,.55],'ochre');
    for(const side of [-1,1]){
        chamfer(shoulder,(side<0?'left':'right')+' heavy shoulder housing',
            [side*.70,.105,-.055],[.40,.69,.69],'ochre',.15);
        bearing(shoulder,(side<0?'left':'right')+' outboard trunnion race',
            [side*.945,.19,-.23],.265,.18,'iron','x',10);
        bearing(shoulder,(side<0?'left':'right')+' machined bearing face',
            [side*1.043,.19,-.23],.192,.035,'bright','x',10);
        bearing(shoulder,(side<0?'left':'right')+' recessed pivot',
            [side*1.067,.19,-.23],.110,.018,'recess','x',10);
    }
    // Short, visible side-load returns tie shoulder bearings into the upper
    // command deck. These are pickable real structural parts, not hit proxies.
    for(const side of [-1,1]){
        beam(shoulder,(side<0?'left':'right')+' cab-side load return',
            [side*.69,.29,.12],[side*.59,.08,.36],.17,.23,'iron');
    }
    const lower=groupAt(r,'BRUISER / LOWER LOAD BRIDGE');
    blockAt(lower,'reinforced lower transverse bridge',[0,-.38,.11],[1.42,.19,.46],'loadSteel');
    // Fabricated forward load lip: tied through the belly rib and load nodes,
    // rather than a hidden hit proxy. This is the heavy frame's vulnerable
    // front-of-hip steel bridge, absent from the Skeleton's open framework.
    blockAt(lower,'heavy frontal mobility cross-load lip',[0,-.65,-.445],
        [1.33,.27,.29],'iron');
    for(const side of [-1,1]){
        beam(lower,(side<0?'left':'right')+' chin-to-bridge gusset',
            [side*.52,-.44,-.29],[side*.49,-.61,-.44],.16,.16,'bright');
    }
    for(const side of [-1,1]){
        blockAt(lower,(side<0?'left':'right')+' downward structural knuckle',
            [side*.50,-.50,.10],[.32,.32,.32],'bright');
        beam(lower,(side<0?'left':'right')+' diagonal shoulder load stay',
            [side*.70,.09,.04],[side*.46,-.39,.11],.15,.20,'iron');
    }
    beam(lower,'centered mobility downstand',[0,-.41,mobility[2]],
        [mobility[0],mobility[1]+.08,mobility[2]],.28,.31,'iron');
    contact(lower,'single U1 mobility flange',
        [mobility[0],mobility[1]+.035,mobility[2]],.27,.07);
    const fittings=groupAt(r,'BRUISER / FUNCTIONAL LANDINGS');
    blockAt(fittings,'upper command load deck',[command[0],.112,command[2]],
        [.77,.11,.59],'iron');
    blockAt(fittings,'upper deck foot beneath cab',[command[0],.175,command[2]],
        [.36,.025,.34],'bright');
    beam(fittings,'front command deck support',[0,-.01,-.31],[0,.10,command[2]],.32,.22,'iron');
    blockAt(fittings,'rear generator backplate',[power[0],power[1]-.08,.49],
        [.70,.32,.17],'raw');
    beam(fittings,'rear generator load path',[0,-.05,.34],[power[0],power[1]-.07,.50],.29,.21,'iron');
    beam(fittings,'right combat transfer stay',[.71,.19,-.19],
        [combat[0]-.12,combat[1],combat[2]+.055],.20,.23,'iron');
    contact(fittings,'right U1 weapon contact face',
        [combat[0]-.055,combat[1],combat[2]],.18,.08,'x');
    blockAt(fittings,'small teal rear service access',[-.33,.02,.53],[.30,.23,.05],'teal');
    return finishFrameVisual(r,fixture);
}
