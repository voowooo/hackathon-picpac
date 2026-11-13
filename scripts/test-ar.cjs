/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { wallCorners, quadMatrix, scaleQuad, moveQuad, quadCenter, resizeQuadDimensions } = require(path.join(__dirname, '../src/features/ar/geometry.ts'));
const { identityRotation, integrateGyroscope, anchorRays, projectRays, resizeRays, smoothRotation, projectStablePoster, previewFocal, resizeRayDimensions } = require(path.join(__dirname, '../src/features/ar/gyroMath.ts'));
let checks = 0;
const check = (condition, text) => { assert.ok(condition, text); checks++; };
const wall = [1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,1,-2,1];
const corners = wallCorners(wall, .4, .6);
check(Math.abs(corners[1][12] - corners[0][12] - .4) < 1e-9, 'Physical width stays in meters');
check(Math.abs(corners[0][13] - corners[3][13] - .6) < 1e-9, 'Poster stays upright on a vertical wall');
check(corners.every(c => Math.abs(c[14] + 1.998) < 1e-9), 'Corners share one wall plane');
assert.throws(() => wallCorners([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1], .4, .6)); checks++;
assert.throws(() => wallCorners([], .4, .6)); checks++;
for (const q of [
  [{x:10,y:20},{x:310,y:20},{x:310,y:420},{x:10,y:420}],
  [{x:30,y:10},{x:210,y:40},{x:245,y:430},{x:5,y:390}],
  [{x:300,y:20},{x:240,y:300},{x:20,y:350},{x:10,y:10}],
]) {
  const matrix = quadMatrix(q, 300, 400);
  check(matrix && matrix.every(Number.isFinite), 'Perspective matrix is finite');
  [[0,0],[300,0],[300,400],[0,400]].forEach(([x,y],i) => {
    const d = matrix[3]*x + matrix[7]*y + matrix[15];
    const px = (matrix[0]*x+matrix[4]*y+matrix[12])/d, py=(matrix[1]*x+matrix[5]*y+matrix[13])/d;
    check(Math.hypot(px-q[i].x,py-q[i].y)<1e-6, 'Every image corner must match its world projection');
  });
  const center = quadCenter(q);
  const scaled = scaleQuad(q, .2);
  check(Math.hypot(quadCenter(scaled).x-center.x,quadCenter(scaled).y-center.y)<1e-6, 'Scale preserves center');
  const moved = moveQuad(q, 60, -35);
  check(Math.abs(quadCenter(moved).x-center.x-60)<1e-6, 'Dragging moves the entire quad together');
}
check(quadMatrix([{x:1,y:1},{x:1,y:1},{x:1,y:1},{x:1,y:1}],300,400)===null,'Degenerate tracking does not render a broken poster');
const viewport = { width: 390, height: 844 };
const rectangle = [{x:145,y:352},{x:245,y:352},{x:245,y:492},{x:145,y:492}];
const q0 = identityRotation();
const rays = anchorRays(rectangle,q0,viewport.width,viewport.height);
const projection = (q) => projectRays(rays,q,viewport.width,viewport.height);
const rotated = (axis,angle) => {
  let q = identityRotation();
  for(let i=0;i<100;i++) q=integrateGyroscope(q,axis,angle/100);
  return q;
};
const original=projection(q0);
check(original.every((p,i)=>Math.hypot(p.x-rectangle[i].x,p.y-rectangle[i].y)<1e-8),'Pinning does not jump the image');
const yaw=rotated({x:0,y:1,z:0},.12);
check(quadCenter(projection(yaw)).x>195,'Turning camera left moves fixed poster right');
const pitch=rotated({x:1,y:0,z:0},.12);
check(quadCenter(projection(pitch)).y>422,'Tilting camera up moves fixed poster down');
const roll=rotated({x:0,y:0,z:1},.12);
check(projection(roll)[1].y>projection(roll)[0].y,'Roll is compensated by rotating the projected poster');
const pinnedAfterTurn=anchorRays(rectangle,yaw,390,844);
const afterTurn=projectRays(pinnedAfterTurn,yaw,390,844);
check(afterTurn.every((p,i)=>Math.hypot(p.x-rectangle[i].x,p.y-rectangle[i].y)<1e-8),'Re-pinning after a turn preserves placement');
check(projection(rotated({x:0,y:1,z:0},Math.PI))===null,'A poster behind the camera does not flip back onto screen');
check(projection(rotated({x:0,y:1,z:0},Math.PI*2)).every((p,i)=>Math.hypot(p.x-rectangle[i].x,p.y-rectangle[i].y)<1e-6),'Looking back recovers the original anchor without angle wrap jumps');
let stationary=q0;
for(let i=0;i<10000;i++) stationary=integrateGyroscope(stationary,{x:.0005,y:.0003,z:.0001},.016);
check(Math.abs(stationary.x)+Math.abs(stationary.y)+Math.abs(stationary.z)>1e-4,'Slow continuous rotation is not discarded by a rate deadzone');
check(integrateGyroscope(q0,{x:0,y:3,z:0},2)===q0,'A paused sensor does not integrate a huge time jump');
const resized=projectRays(resizeRays(rays,.24),q0,390,844);
check(Math.abs(resized[1].x-resized[0].x-24)<1e-6,'Small anchored posters can be resized independently of their touch area');
check(Math.abs(Math.hypot(yaw.x,yaw.y,yaw.z,yaw.w)-1)<1e-10,'Quaternion remains normalized');
const {smoothProjection}=require(path.join(__dirname,'../src/features/ar/projectionFilter.ts'));
const near=(a,b,eps=1e-7)=>Math.abs(a-b)<eps;
const sameRotation=(a,b)=>Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w)>1-1e-8;
const negative={x:-yaw.x,y:-yaw.y,z:-yaw.z,w:-yaw.w};
check(smoothRotation(yaw,negative,.016)===yaw,'Equivalent quaternion signs do not cause a full spin');
let filtered=q0;
for(let i=0;i<5000;i++) filtered=smoothRotation(filtered,rotated({x:0,y:1,z:0},Math.sin(i)*.0002),.016);
check(filtered===q0,'Stationary attitude noise stays below the display deadband');
filtered=smoothRotation(q0,yaw,.016);
check(sameRotation(smoothRotation(filtered,yaw,1),yaw),'A moving pose converges without unbounded extrapolation');
check(near(previewFocal(390,844),390/(2*Math.tan(Math.PI/6))),'Portrait preview keeps its previous movement gain');
for(const angle of [-.7,-.4,0,.4,.7]) {
  const pose=rotated({x:0,y:1,z:0},angle);
  const stable=projectStablePoster(rays,pose,390,844,rectangle);
  check(stable && near(Math.hypot(stable[1].x-stable[0].x,stable[1].y-stable[0].y),100),'Looking away does not grow the rotation-only poster');
  check(stable && near(Math.hypot(stable[3].x-stable[0].x,stable[3].y-stable[0].y),140),'Looking away preserves poster height');
}
const turnedPin=projectStablePoster(pinnedAfterTurn,yaw,390,844,rectangle);
check(turnedPin.every((p,i)=>near(p.x,rectangle[i].x)&&near(p.y,rectangle[i].y)),'Stable projection has no re-pinning jump');
check(projectStablePoster(rays,rotated({x:0,y:1,z:0},Math.PI),390,844,rectangle)===null,'Stable poster hides behind the camera');
const stableSmall=projectStablePoster(resizeRays(rays,.2),yaw,390,844,scaleQuad(rectangle,.2));
check(near(Math.hypot(stableSmall[1].x-stableSmall[0].x,stableSmall[1].y-stableSmall[0].y),20),'Pinned scale buttons change size without changing perspective gain');
const tinyNoise=moveQuad(rectangle,.05,-.05);
check(smoothProjection(rectangle,tinyNoise,.016)===rectangle,'Native subpixel jitter is held still');
const movedTarget=moveQuad(rectangle,20,30), smoothed=smoothProjection(rectangle,movedTarget,.016);
check(quadCenter(smoothed).x>195 && quadCenter(smoothed).x<215,'Native motion is smoothed without overshooting');
check(near(smoothed[1].x-smoothed[0].x,100)&&near(smoothed[3].y-smoothed[0].y,140),'Native corners share one smoothing factor');
check(smoothProjection(null,rectangle,.016)===rectangle,'Recovered tracking does not animate from a stale screen position');
check(smoothProjection(rectangle,movedTarget,.5)===movedTarget,'Resuming after a gap does not trail the old pose');
let native=rectangle;
for(let i=0;i<50;i++)native=smoothProjection(native,scaleQuad(rectangle,1.3),.016);
check(Math.abs(native[1].x-native[0].x-130)<.3,'Real AR retains legitimate distance-dependent scale changes');
const {angularVelocity,createRelativeMotion}=require(path.join(__dirname,'../src/features/ar/relativeMotion.ts'));
for(const [platform,values] of [['ios',{alpha:30,beta:20,gamma:10}],['android',{alpha:10,beta:20,gamma:30}],['web',{alpha:30,beta:10,gamma:20}]]) {
  const velocity=angularVelocity({rotationRate:values},platform);
  check(near(velocity.x,10*Math.PI/180)&&near(velocity.y,20*Math.PI/180)&&near(velocity.z,30*Math.PI/180),'Platform angular velocities use physical X/Y/Z axes in radians');
}
const relative=createRelativeMotion('ios');
const motionSample=(time,x=0,y=0,z=0)=>({rotationRate:{alpha:z,beta:y,gamma:x,timestamp:time},rotation:{alpha:Math.PI,beta:Math.PI/2,gamma:-Math.PI}});
check(sameRotation(relative.update(motionSample(0),0).rotation,q0),'Initial arbitrary absolute orientation has no influence');
for(let i=1;i<=60;i++) relative.update(motionSample(i/60),i/60);
check(sameRotation(relative.update(motionSample(61/60),61/60).rotation,q0),'No-rate samples do not move a pinned poster');
for(const axis of ['x','y','z']) {
  const tracker=createRelativeMotion('ios'); tracker.update(motionSample(0,axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0),0);
  let update;
  for(let i=1;i<=60;i++) update=tracker.update(motionSample(i/60,axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0),i/60);
  check(sameRotation(update.rotation,rotated({x:axis==='x'?1:0,y:axis==='y'?1:0,z:axis==='z'?1:0},Math.PI/180)),'One degree of physical movement stays one degree on each axis');
  const stable=projectStablePoster(rays,update.rotation,390,844,rectangle);
  check(stable&&Math.hypot(quadCenter(stable).x-195,quadCenter(stable).y-422)<8,'A one-degree input cannot fling the poster across the display');
}
const gap=createRelativeMotion('web'); gap.update(motionSample(0),0);
check(gap.update(motionSample(1,40),1).interrupted,'Paused data resets relative motion instead of integrating a jump');
check(gap.update(motionSample(.5),.5)===null,'Out-of-order sensor samples are ignored');
check(angularVelocity({rotationRate:{alpha:Infinity,beta:0,gamma:0}},'ios')===null,'Nonfinite angular velocity is rejected');
check(angularVelocity({rotationRate:{alpha:1e6,beta:0,gamma:0}},'ios')===null,'Corrupt rate spikes are rejected');
check(angularVelocity({acceleration:{x:10,y:10,z:10}},'web')===null,'Linear acceleration must never drive poster rotation');
for(const extension of ['.png','.jpg']) require.extensions[extension]=module=>{module.exports=1;};
const {posterFormats,selectedPosterFormat,adjacentPosterFormat}=require(path.join(__dirname,'../src/features/ar/posterFormats.ts'));
assert.deepEqual(posterFormats(false),[{id:'30x40',widthCm:30,heightCm:40},{id:'40x60',widthCm:40,heightCm:60},{id:'50x70',widthCm:50,heightCm:70}]); checks++;
check(adjacentPosterFormat('30x40',-1,false).id==='30x40','Minus cannot invent a smaller print format');
check(adjacentPosterFormat('50x70',1,false).id==='50x70','Plus cannot invent a larger print format');
check(adjacentPosterFormat('30x40',1,false).id==='40x60'&&adjacentPosterFormat('40x60',1,false).id==='50x70','Plus steps through actual catalog formats');
check(adjacentPosterFormat('50x70',-1,false).id==='40x60','Minus returns the preceding real format');
check(selectedPosterFormat('missing',false).id==='30x40','Invalid saved format falls back to a catalog entry');
check(selectedPosterFormat('40x60',true).widthCm===60&&selectedPosterFormat('40x60',true).heightCm===40,'Landscape uses the same available paper formats');
const awayFromOpticalCenter=moveQuad(rectangle,-50,-140);
const awayRays=anchorRays(awayFromOpticalCenter,q0,390,844);
for(const axis of [{x:0,y:1,z:0},{x:1,y:0,z:0}])for(const angle of [-.4,-.2,.2,.4]) {
 const projected=projectStablePoster(awayRays,rotated(axis,angle),390,844,awayFromOpticalCenter);
 check(projected&&Math.abs(projected[1].y-projected[0].y)<1e-7,'Off-center yaw/pitch must not produce artificial poster tilt');
}
const actualRoll=projectStablePoster(awayRays,roll,390,844,awayFromOpticalCenter);
check(actualRoll[1].y>actualRoll[0].y,'Actual optical roll is still compensated');
const paperQuad=[{x:150,y:300},{x:240,y:300},{x:240,y:420},{x:150,y:420}];
const resizedPaper=resizeQuadDimensions(paperQuad,40/30,60/40);
check(near(resizedPaper[1].x-resizedPaper[0].x,120)&&near(resizedPaper[3].y-resizedPaper[0].y,180),'Format change resizes width and height independently');
check(near(quadCenter(resizedPaper).x,195)&&near(quadCenter(resizedPaper).y,360),'Format change preserves the placed center');
const dimensionRays=resizeRayDimensions(anchorRays(paperQuad,q0,390,844),40/30,60/40);
const projectedFormat=projectStablePoster(dimensionRays,q0,390,844,resizedPaper);
check(projectedFormat.every((p,i)=>near(p.x,resizedPaper[i].x)&&near(p.y,resizedPaper[i].y)),'Pinned rays and print dimensions stay in sync');
const ramp=createRelativeMotion('ios');ramp.update(motionSample(0),0);let rampResult;
for(let i=1;i<=60;i++)rampResult=ramp.update(motionSample(i/60,2*i/60),i/60);
check(sameRotation(rampResult.rotation,rotated({x:1,y:0,z:0},Math.PI/180)),'Midpoint integration follows changing angular speed without endpoint overshoot');
const {stepPreviewSize,samePreviewSize,MIN_PREVIEW_CM,MAX_PREVIEW_CM,displayCentimeters}=require(path.join(__dirname,'../src/features/ar/previewSize.ts'));
const baseSize={widthCm:30,heightCm:40};
let freely=baseSize;
for(let i=0;i<40;i++)freely=stepPreviewSize(freely,baseSize,-1);
check(near(freely.widthCm,MIN_PREVIEW_CM),'Button sizes have a small recoverable minimum');
freely=stepPreviewSize(freely,baseSize,1);
check(near(freely.widthCm,MIN_PREVIEW_CM+1),'Plus recovers immediately from the smallest size');
for(let i=0;i<200;i++)freely=stepPreviewSize(freely,baseSize,1);
check(near(freely.widthCm,MAX_PREVIEW_CM),'Button sizes have a finite upper bound');
check(samePreviewSize(stepPreviewSize(baseSize,baseSize,1),{widthCm:31,heightCm:124/3}),'One tap changes the short side by exactly one centimeter');
check(near(stepPreviewSize(baseSize,baseSize,-1,5).widthCm,25),'Long press uses a five-centimeter step');
check(samePreviewSize(stepPreviewSize(stepPreviewSize(baseSize,baseSize,-1),baseSize,1),baseSize),'Size steps are reversible without cumulative rounding');
const landscapeSize={widthCm:60,heightCm:40},landscapeStep=stepPreviewSize(landscapeSize,landscapeSize,-1);
check(near(landscapeStep.heightCm,39)&&near(landscapeStep.widthCm/landscapeStep.heightCm,1.5),'Landscape short-side steps preserve aspect ratio');
check(displayCentimeters(40/3)==='13,3','Fractional preview dimensions are shown to one decimal');
const calibrated=createRelativeMotion('ios',true);
let calibratedPose;
const degreesPerRadian=180/Math.PI;
for(let i=0;i<=1000;i++)calibratedPose=calibrated.update(motionSample(i/60,.0004*degreesPerRadian,.0002*degreesPerRadian,0),i/60);
check(!calibratedPose.calibrating&&sameRotation(calibratedPose.rotation,q0),'A quiet initial sensor bias does not accumulate into poster drift');
const slowTracker=createRelativeMotion('ios',true);let slowPose;
for(let i=0;i<=60;i++)slowPose=slowTracker.update(motionSample(i/60,.002*degreesPerRadian,0,0),i/60);
check(!slowPose.calibrating&&Math.abs(slowPose.rotation.x)>.0005,'Real slow turns are not learned as zero movement');
const movingTracker=createRelativeMotion('ios',true);
check(!movingTracker.update(motionSample(0,2),0).calibrating,'Moving phones bypass stationary bias estimation');
const noisyTracker=createRelativeMotion('ios',true);let noisyPose;
for(let i=0;i<=600;i++)noisyPose=noisyTracker.update(motionSample(i/60,(i%2?.002:0)*degreesPerRadian,0,0),i/60);
check(!noisyPose.calibrating&&Math.abs(noisyPose.rotation.x)>.001,'Variable hand motion is not accepted as stable sensor bias');
console.log(`AR geometry and gyro: ${checks} checks passed`);
