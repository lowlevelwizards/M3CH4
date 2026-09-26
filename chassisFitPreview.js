/** k.3a.2 -- standalone Chassis Lab fit controller. It cannot edit the game. */
import * as THREE from 'three';
import { standardFitFixtures } from './chassisFitFixtures.js';
import { analyzeFit } from './chassisFitValidation.js';
import { buildFitFixture, disposeFitGeometry } from './chassisFitVisuals.js';

const escapeFocus=id=>id==null?null:String(id);
export function createFitPreviewController({scene,onVisualChange=()=>{}}){
    const switchers=[...document.querySelectorAll('[data-assembly-mode]')];
    const visibility=document.getElementById('fixture-visibility');
    const summary=document.getElementById('fit-summary');
    const results=document.getElementById('fit-results');
    const selected=document.getElementById('fit-selected');
    const fixtures=standardFitFixtures();
    const enabled=new Map(fixtures.map(f=>[f.id,true]));
    let frame=null, analysis=null,visual=new THREE.Group(), mode='bare',focus=null;
    scene.add(visual);

    for(const fixture of fixtures){
        const label=document.createElement('label');label.className='fixture-toggle';
        const input=document.createElement('input');input.type='checkbox';input.checked=true;
        input.setAttribute('aria-label',`Show ${fixture.name}`);
        const name=document.createElement('span');name.textContent=fixture.name;
        const metric=document.createElement('small');metric.textContent=`${fixture.massKg} kg`;
        label.append(input,name,metric);visibility.append(label);
        input.addEventListener('change',()=>{
            enabled.set(fixture.id,input.checked);
            applyVisibility();
        });
    }
    function applyVisibility(){
        for(const child of visual.children){
            const active=enabled.get(child.userData.fitFixtureId)!==false;
            child.visible=active;
            child.userData.outline.visible=active&&child.userData.fitFixtureId===focus;
        }
        onVisualChange();
    }
    function clearVisual(){
        for(const child of [...visual.children]){
            visual.remove(child);disposeFitGeometry(child);
        }
    }
    function rebuild(){
        clearVisual();
        if(!frame)return;
        analysis=analyzeFit(frame,fixtures);
        for(const item of analysis.components){
            if(!item.pose)continue;
            const model=buildFitFixture(item.fixture);
            const x=new THREE.Vector3(...item.pose.rotation[0]);
            const y=new THREE.Vector3(...item.pose.rotation[1]);
            const z=new THREE.Vector3(...item.pose.rotation[2]);
            model.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
            model.position.set(...item.pose.position);
            visual.add(model);
        }
        applyVisibility();renderResults();
    }
    function renderResults(){
        results.replaceChildren();
        if(!frame||!analysis)return;
        const issues=analysis.issues;
        const errors=issues.filter(i=>i.severity==='error');
        const warnings=issues.filter(i=>i.severity==='review');
        const passes=issues.filter(i=>i.severity==='pass');
        const equipmentKg=fixtures.reduce((sum,f)=>sum+f.massKg,0);
        summary.textContent=`${analysis.status.toUpperCase()}  ·  ${passes.length} passed  ·  ${warnings.length} review  ·  ${errors.length} blocked · ${equipmentKg.toLocaleString()} kg equipment (frame unrated)`;
        summary.dataset.status=analysis.status;
        const groups=[['Needs review',warnings],['Mounting errors',errors],['Verified from preview data',passes]];
        for(const [title,list] of groups){
            if(!list.length)continue;
            const h=document.createElement('h4');h.textContent=`${title} (${list.length})`;results.append(h);
            for(const event of list){
                const button=document.createElement('button');button.type='button';button.className=`fit-event ${event.severity}`;
                button.textContent=event.message;
                button.title='Tap to inspect/highlight this equipment';
                button.addEventListener('click',()=>selectFixture(event.fixtureIds[0]));
                results.append(button);
            }
        }
        renderSelection();
    }
    function renderSelection(){
        selected.textContent='Tap a visible component or diagnostic to inspect its physical interface.';
        if(!focus||!analysis)return;
        const fixture=fixtures.find(f=>f.id===focus),pose=analysis.poses.get(focus);
        if(!fixture||!pose)return;
        const socket=frame.sockets.find(s=>s.id===pose.socketId);
        const events=analysis.issues.filter(i=>i.severity!=='pass'&&i.fixtureIds.includes(focus));
        selected.textContent=`${fixture.name}\n${fixture.massKg} kg · ${fixture.envelope.join(' × ')} m\n`+
            `Mount: ${fixture.face} → ${socket.id} (${socket.standard})\n`+
            `Centre XYZ: ${pose.position.map(n=>n.toFixed(3)).join(', ')}\n`+
            `Interface XYZ: ${pose.matingWorld.map(n=>n.toFixed(3)).join(', ')}\n`+
            (events.length?`\nREVIEW:\n${events.map(i=>i.message).join('\n')}`:'\nNo envelope warnings for this component.');
    }
    function selectFixture(id){
        focus=escapeFocus(id);
        for(const child of visual.children){
            child.userData.outline.visible=child.visible&&child.userData.fitFixtureId===focus;
        }
        renderSelection();
    }
    function setMode(next){
        if(next!=='bare'&&next!=='assembled')return;
        mode=next;visual.visible=mode==='assembled';
        for(const button of switchers)button.setAttribute('aria-pressed',String(button.dataset.assemblyMode===mode));
        visibility.hidden=mode!=='assembled';
        results.parentElement.hidden=mode!=='assembled';
        onVisualChange();
    }
    for(const button of switchers)button.addEventListener('click',()=>setMode(button.dataset.assemblyMode));
    function setFrame(next){
        frame=next;focus=null;rebuild();
        visual.visible=mode==='assembled';
        onVisualChange();
    }
    function pick(clientX,clientY,camera,renderer){
        if(mode!=='assembled'||!visual.visible)return false;
        const rect=renderer.domElement.getBoundingClientRect();
        const pointer=new THREE.Vector2(((clientX-rect.left)/rect.width)*2-1,-((clientY-rect.top)/rect.height)*2+1);
        const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);
        const hit=ray.intersectObjects(visual.children,true).find(h=>h.object.userData.fitFixtureId);
        if(!hit)return false;
        selectFixture(hit.object.userData.fitFixtureId);return true;
    }
    setMode('bare');
    return {setFrame,setMode,pick,get mode(){return mode;},get visual(){return visual;},get analysis(){return analysis;}};
}
