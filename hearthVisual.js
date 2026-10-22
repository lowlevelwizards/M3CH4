/** HEARTH / low, broad welded bunker. The front viewing gap is physical. */
import * as THREE from 'three';
import {groupAt,block,chamferBlock,wedge,mountCollar,finishCommandVisual} from './commandVisualKit.js';
export function buildHearthVisual(fixture){
    const root=new THREE.Group();root.name='fit-fixture:cab-armored';
    const cell=groupAt(root,'HEARTH / REINFORCED CREW CELL');
    chamferBlock(cell,'dark low pressure enclosure',[0,-.097,.160],[1.165,.665,.91],
        'iron',.10);
    const face=groupAt(root,'HEARTH / SLOPED BLAST SHIELD');
    // Two disconnected front lips leave a true narrow visible gap at -Z.
    // The buried dark insert can be shot, but does not block the gap with cream.
    wedge(face,'massive lower cream blast wedge',[0,0,-.260],{
        frontWidth:1.100,rearWidth:1.190,depth:.635,
        frontBottom:-.365,frontTop:.038,rearBottom:-.365,rearTop:.279,
    },'cream');
    wedge(face,'overlapping upper cream armored brow',[0,0,-.260],{
        frontWidth:1.117,rearWidth:1.182,depth:.635,
        frontBottom:.122,frontTop:.269,rearBottom:.241,rearTop:.408,
    },'cream');
    block(face,'deep recessed black vision aperture',[0,.080,-.557],
        [.873,.075,.017],'opticRecess');
    block(face,'narrow protected inner optic strip',[0,.080,-.569],
        [.752,.027,.007],'glass');
    // Small armored vision-gap end stops remain entirely inside the real
    // cab envelope; the central optical slit remains open and hittable.
    for(const sign of [-1,1]){
        chamferBlock(face,sign<0?'left brow end stop':'right brow end stop',
            [sign*.495,.085,-.525],[.105,.11,.115],'ochre',.12);
    }
    const armor=groupAt(root,'HEARTH / LARGE SIDE CHEEKS');
    for(const sign of [-1,1]){
        chamferBlock(armor,sign<0?'left armored cheek':'right armored cheek',
            [sign*.633,-.032,-.075],[.220,.555,.810],'ochre',.18);
    }
    const rear=groupAt(root,'HEARTH / REAR MACHINERY AND ROOF');
    block(rear,'heavy rear structural cassette',[0,-.09,.467],
        [1.15,.65,.292],'iron');
    chamferBlock(rear,'low protective roof armor',[0,.419,.140],
        [1.15,.092,.824],'loadSteel',.035);
    block(rear,'small teal service hatch',[0,.472,.252],
        [.442,.029,.355],'teal');
    block(rear,'rear access equipment block',[0,.038,.557],
        [.570,.286,.095],'raw');
    mountCollar(root,fixture.envelope[1],.24);
    return finishCommandVisual(root,fixture,'low sloped crew bunker');
}
