import { identityRotation, integrateGyroscope, type Vector3 } from './gyroMath';

type Platform = 'ios' | 'android' | 'web';
type MotionSample = { rotationRate?: { alpha: number; beta: number; gamma: number; timestamp?: number } | null };

/** Read body-axis angular velocity only; compass/Euler orientation never drives placement. */
export function angularVelocity(sample: MotionSample, platform: Platform): Vector3 | null {
  const rate = sample.rotationRate;
  if (!rate || ![rate.alpha, rate.beta, rate.gamma].every(Number.isFinite)) return null;
  const k = Math.PI / 180;
  const vector = platform === 'ios' ? { x: rate.gamma*k, y: rate.beta*k, z: rate.alpha*k }
    : platform === 'android' ? { x: rate.alpha*k, y: rate.beta*k, z: rate.gamma*k }
    : { x: rate.beta*k, y: rate.gamma*k, z: rate.alpha*k };
  return Math.hypot(vector.x, vector.y, vector.z) <= 25 ? vector : null;
}

export function createRelativeMotion(platform: Platform, calibrate = false) {
  let rotation = identityRotation(), lastTime: number | null = null;
  let previousRate: Vector3 | null = null;
  let calibrating = calibrate, calibrationStart: number | null = null;
  let calibrationRates: Vector3[] = [];
  let bias: Vector3 = {x:0,y:0,z:0};
  const magnitude=(v:Vector3)=>Math.hypot(v.x,v.y,v.z);
  const corrected=(v:Vector3)=>({x:v.x-bias.x,y:v.y-bias.y,z:v.z-bias.z});
  return {
    update(sample: MotionSample, fallbackTime: number) {
      const measured = angularVelocity(sample, platform);
      if (!measured) return null;
      const timestamp = sample.rotationRate?.timestamp;
      const time = typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : fallbackTime;
      if (!Number.isFinite(time) || (lastTime !== null && time <= lastTime)) return null;
      const dt = lastTime === null ? 0 : time-lastTime;
      lastTime = time;
      const interrupted = dt > .3;
      if(calibrating) {
        calibrationStart ??= time;
        calibrationRates.push(measured);
        // Never learn normal hand motion as bias. A moving device starts without correction.
        if(magnitude(measured)>.004) calibrating=false;
        else if(time-calibrationStart>=.24 && calibrationRates.length>=8) {
          const count=calibrationRates.length;
          const mean=calibrationRates.reduce((a,v)=>({x:a.x+v.x/count,y:a.y+v.y/count,z:a.z+v.z/count}),{x:0,y:0,z:0});
          const variance=calibrationRates.reduce((n,v)=>n+((v.x-mean.x)**2+(v.y-mean.y)**2+(v.z-mean.z)**2)/count,0);
          if(magnitude(mean)<=.00075 && Math.sqrt(variance)<=.0005) bias=mean;
          calibrating=false;
        }
        if(!calibrating) {calibrationRates=[];previousRate=corrected(measured);}
        return {rotation,interrupted,calibrating};
      }
      const rate=corrected(measured);
      const midpoint=previousRate ? {x:(rate.x+previousRate.x)/2,y:(rate.y+previousRate.y)/2,z:(rate.z+previousRate.z)/2} : rate;
      rotation = interrupted ? identityRotation() : integrateGyroscope(rotation, midpoint, dt);
      previousRate=rate;
      return { rotation, interrupted, calibrating:false };
    },
  };
}
