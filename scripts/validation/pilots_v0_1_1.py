"""Pilot runs that calibrated the v0.1.1 tolerances (k = 1.05, 1.20, 1.45, 0.97)

Part of the v0.1.1 pre-registration record (docs/requirements-0.1.1.md §5, §7).
It runs only NON-registered pilot configurations or closed-form formulas; it is not a case runner.
"""
import sys,math,time; sys.path.insert(0,str(__import__('pathlib').Path(__file__).resolve().parents[2]/'src'))
import numpy as np, orbital as o
from _kepler_pilot import elements, state_at
MU,RE=o.MU_EARTH,o.R_EARTH; r0n=RE+400e3; vc=math.sqrt(MU/r0n)
def run(k,dt,dur):
    r0=np.array([r0n,0.]); v0=np.array([0.,k*vc]); n=o.steps_for_duration(dur,dt)
    tr=o.propagate(r0,v0,dt,n); return tr, elements(r0,v0,MU)
def lead_energy(el,dt):
    # leading-order modified-energy amplitude: (dt/2)*max mu|rdot|/r^2 / |eps|
    p=el['a']*(1-el['e']**2); best=0
    for nu in np.linspace(0,2*math.pi,20001):
        r=p/(1+el['e']*math.cos(nu)); rdot=math.sqrt(MU/p)*el['e']*math.sin(nu)
        best=max(best,MU*abs(rdot)/r**2)
    return dt/2*best/abs(el['eps'])
print("== ellipse pilots (NOT the registered k=1.10)")
for k in (1.05,1.20):
    tr,el=run(k,1.0,2*2*math.pi*math.sqrt((r0n/(2-k*k))**3/MU))
    a=el['a']; T=2*math.pi*math.sqrt(a**3/MU); ra=a*(1+el['e'])
    eps=o.specific_energy(tr.r,tr.v,MU); hz=o.angular_momentum_z(tr.r,tr.v)
    ex=np.array([state_at(el,t,MU) for t in tr.t])
    err=np.hypot(*(tr.r-ex).T); n1=o.steps_for_duration(T,1.0)
    first=tr.t<=T
    rmax=np.max(o.radius(tr.r[first]))
    tr2,_=run(k,0.1,T); ex2=np.array([state_at(el,t,MU) for t in tr2.t]); err2=np.hypot(*(tr2.r-ex2).T)
    print(f"k={k}: e={el['e']:.4f} energy max={np.max(abs((eps-eps[0])/eps[0])):.3e} (lead-order pred {lead_energy(el,1.0):.3e}) "
          f"h={np.max(abs((hz-hz[0])/hz[0])):.2e} period={abs(o.first_period(tr)-T)/T:.3e} apo={abs(rmax-ra)/ra:.3e} "
          f"pos@n1={err[n1]:.1f} m  maxpos(1st orbit)={np.max(err[first]):.1f} m  maxpos(dt0.1)={np.max(err2):.1f} ratio={np.max(err[first])/np.max(err2):.2f}")
print("== escape pilot k=1.45 (NOT registered 1.42)")
k=1.45; tr,el=run(k,1.0,86400.0)
eps=o.specific_energy(tr.r,tr.v,MU); hz=o.angular_momentum_z(tr.r,tr.v)
for tt in (3600,21600,86400):
    i=int(round(tt)); ex=state_at(el,tr.t[i],MU); print(f"  t={tt}: rel pos err={np.hypot(*(tr.r[i]-ex))/np.hypot(*ex):.3e} |r|={np.hypot(*ex)/1e3:.0f} km")
print(f"  energy |deps|/(mu/r0)={np.max(abs(eps-eps[0]))/(MU/r0n):.3e}")
print(f"  h={np.max(abs((hz-hz[0])/hz[0])):.2e} min eps>0: {np.min(eps)>0}")
tr3,_=run(k,0.1,3600.0); ex1=np.array([state_at(el,t,MU) for t in tr.t[:3601]]); ex3=np.array([state_at(el,t,MU) for t in tr3.t])
m1=np.max(np.hypot(*(tr.r[:3601]-ex1).T)); m3=np.max(np.hypot(*(tr3.r-ex3).T)); print(f"  conv first hour maxpos dt1={m1:.1f} dt0.1={m3:.2f} ratio={m1/m3:.2f}")
print("== impact pilot k=0.97 (NOT registered 0.98)")
for dt in (1.0,0.1):
    k=0.97; tr,el=run(k,dt,4000.0); a,e=el['a'],el['e']
    E=2*math.pi-math.acos((1-RE/a)/e); M=E-e*math.sin(E); tstar=(M-math.pi)/math.sqrt(MU/a**3)
    print(f"  dt={dt}: status={tr.status} t_detect={tr.t[-1]:.1f} t*={tstar:.3f} diff={tr.t[-1]-tstar:+.3f} s")
