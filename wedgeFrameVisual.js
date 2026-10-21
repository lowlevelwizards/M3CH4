/** W-3 Wedge -- closed low stressed shell, not a dressed-up rail chassis. */
import {frameRoot,finishFrameVisual,socket,groupAt,blockAt,chamfer,bearing,beam,contact,shell} from './frameVisualKit.js';
export function buildWedgeFrameVisual(fixture){
    const r=frameRoot(fixture,'low armored stressed-shell monocoque');
    const mobility=socket(fixture,'mobility'),command=socket(fixture,'command'),
        power=socket(fixture,'power'),combat=socket(fixture,'combat');
    const hull=groupAt(r,'WEDGE / CONTINUOUS STRUCTURAL SHELL');
    shell(hull,'closed faceted monocoque',[0,-.13,.045],{
        frontWidth:1.20,rearWidth:1.72,depth:1.72,
        frontBottom:-.27,frontTop:-.13,rearBottom:-.27,rearTop:.23,
    },'iron');
    const nose=groupAt(r,'WEDGE / BROAD CREAM FORWARD ARMOR');
    shell(nose,'large continuous sloping cream nose',[0,-.09,-.24],{
        frontWidth:1.17,rearWidth:1.54,depth:1.24,
        frontBottom:-.18,frontTop:-.015,rearBottom:-.18,rearTop:.37,
    },'cream');
    shell(nose,'blunt lower nose strengthener',[0,-.31,-.57],{
        frontWidth:1.14,rearWidth:1.32,depth:.57,
        frontBottom:-.09,frontTop:.04,rearBottom:-.09,rearTop:.13,
    },'raw');
    const sides=groupAt(r,'WEDGE / STRESSED SIDEWALLS');
    for(const side of [-1,1]){
        shell(sides,(side<0?'left':'right')+' thick shell sidewall',
            [side*.72,-.105,.03],{
                frontWidth:.22,rearWidth:.31,depth:1.60,
                frontBottom:-.31,frontTop:.13,rearBottom:-.31,rearTop:.29,
            },'iron');
        shell(sides,(side<0?'left':'right')+' faceted mustard side cheek',
            [side*.73,.085,-.10],{
                frontWidth:.215,rearWidth:.34,depth:1.32,
                frontBottom:-.18,frontTop:.08,rearBottom:-.22,rearTop:.24,
            },'ochre');
        // A strong high-side forward shoulder lip catches real shallow-angle
        // frontal hits, while the exposed central cab remains hittable.
        shell(sides,(side<0?'left':'right')+' forward protective shell return',
            [side*.505,.40,-.77],{
                frontWidth:.29,rearWidth:.32,depth:.54,
                frontBottom:-.26,frontTop:.235,rearBottom:-.31,rearTop:.31,
            },'ochre');
    }
    const mounts=groupAt(r,'WEDGE / INTEGRATED BEARINGS AND REAR BULKHEAD');
    blockAt(mounts,'solid dark rear bulkhead',[0,-.09,.77],[1.53,.43,.19],'iron');
    blockAt(mounts,'teal rear power fitting',[power[0],power[1]-.12,.80],
        [.63,.25,.19],'teal');
    blockAt(mounts,'power contact structural return',[0,power[1]-.12,.53],
        [.44,.26,.40],'loadSteel');
    for(const side of [-1,1]){
        bearing(mounts,(side<0?'left':'right')+' integrated wall pivot',
            [side*.985,.17,-.54],.245,.15,'iron','x',10);
        bearing(mounts,(side<0?'left':'right')+' small machined outer hub',
            [side*1.06,.17,-.54],.17,.035,'bright','x',10);
    }
    beam(mounts,'right weapon load transfer',
        [.75,.12,-.49],[combat[0]-.10,combat[1],combat[2]],.20,.25,'iron');
    contact(mounts,'combat U1 actual outboard seat',
        [combat[0]-.025,combat[1],combat[2]],.18,.06,'x');
    const deck=groupAt(r,'WEDGE / SHELL MOUNTING DECK');
    blockAt(deck,'integral low command platform',[command[0],.063,command[2]],
        [.73,.115,.56],'iron');
    blockAt(deck,'machined command U1 landing',[command[0],.132,command[2]],
        [.34,.024,.32],'bright');
    beam(deck,'shell-to-command bearer',[0,-.13,-.20],[0,.055,command[2]],.39,.28,'iron');
    const belly=groupAt(r,'WEDGE / REINFORCED UNDERFLOOR');
    blockAt(belly,'broad bottom monocoque floor',[0,-.42,.06],
        [1.43,.13,1.48],'iron');
    blockAt(belly,'single center load distributor',[0,-.54,mobility[2]],
        [.56,.18,.48],'bright');
    beam(belly,'single mobility connection downstand',[0,-.57,mobility[2]],
        [mobility[0],mobility[1]+.045,mobility[2]],.35,.37,'iron');
    contact(belly,'single U1 belly flange',
        [mobility[0],mobility[1]+.025,mobility[2]],.26,.055);
    return finishFrameVisual(r,fixture);
}
