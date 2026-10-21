/** CYCLOPS / compact salvaged single-optic operator cell. */
import * as THREE from 'three';
import {groupAt,block,chamferBlock,disk,beamBetween,mountCollar,finishCommandVisual} from './commandVisualKit.js';
export function buildCyclopsVisual(fixture){
    const root=new THREE.Group();root.name='fit-fixture:cab-cyclops';
    const body=groupAt(root,'CYCLOPS / PILOT CELL');
    chamferBlock(body,'dark occupied operator tub',[0,-.055,.080],[.96,.67,.82],'iron',.085);
    chamferBlock(body,'mustard central outer casing',[0,-.035,-.055],[.82,.58,.68],'ochre',.10);
    block(body,'steel lower pressure sill',[0,-.319,.045],[.88,.105,.68],'raw');
    const optics=groupAt(root,'CYCLOPS / OPTIC ASSEMBLY');
    chamferBlock(optics,'square structural optical carrier',[-.06,.072,-.427],[.57,.55,.132],'iron',.085);
    block(optics,'recessed square optical well',[-.06,.072,-.500],[.451,.43,.012],'opticRecess');
    disk(optics,'outer machined circular bezel',[-.06,.072,-.512],.235,.047,'bright');
    disk(optics,'dark recessed lens surround',[-.06,.072,-.541],.195,.017,'opticRecess');
    disk(optics,'single protected teal objective',[-.06,.072,-.555],.163,.013,'optic');
    disk(optics,'inner optical aperture',[-.06,.072,-.566],.091,.007,'glass');
    const cheeks=groupAt(root,'CYCLOPS / DETACHABLE CHEEKS');
    chamferBlock(cheeks,'right cream service armor',[.505,-.020,.054],[.195,.535,.65],'cream',.16);
    chamferBlock(cheeks,'left compact guard',[-.508,-.075,.065],[.142,.445,.49],'cream',.16);
    const rear=groupAt(root,'CYCLOPS / REAR MACHINERY');
    chamferBlock(rear,'teal rear service enclosure',[0,-.013,.400],[.69,.425,.29],'teal',.07);
    block(rear,'low roof electronics housing',[.16,.355,.177],[.32,.13,.235],'loadSteel');
    block(rear,'roof equipment cover',[.16,.421,.177],[.28,.014,.22],'teal');
    // A tiny welded carrying handle lies inside the specified envelope.
    beamBetween(rear,'rear lift handle left',[-.20,.318,.38],[-.20,.420,.38],.026,.035,'iron');
    beamBetween(rear,'rear lift handle right',[.02,.318,.38],[.02,.420,.38],.026,.035,'iron');
    block(rear,'rear lift grip',[-.09,.426,.38],[.245,.025,.038],'iron');
    mountCollar(root,fixture.envelope[1],.20);
    return finishCommandVisual(root,fixture,'square optical workhorse');
}
