"""Closed-form numbers behind the v0.1.1 predictions and tolerances (no propagation)

Part of the v0.1.1 pre-registration record (docs/requirements-0.1.1.md §5, §7).
It runs only NON-registered pilot configurations or closed-form formulas; it is not a case runner.
"""
# Closed-form two-body quantities only. Does NOT import orbital.propagate.
import math
import numpy as np
MU=3.986004418e14; RE=6378137.0; OMEGA=7.292115e-5
r0=RE+400e3; vc=math.sqrt(MU/r0); T0=2*math.pi*math.sqrt(r0**3/MU); h0=2*math.pi/T0*1.0
print(f"V0: r0={r0} T0={T0:.6f} h=omega*dt={h0:.6e}")
# P1
aG=(MU/OMEGA**2)**(1/3); altG=aG-RE; TG=2*math.pi/OMEGA; h1=OMEGA*10; rho=h1/h0
print(f"P1: a={aG:.6f} alt={altG:.6f} T={TG:.6f} h={h1:.6e} rho={rho:.5f}")
nT=math.floor(TG/10 + 1e-9); print("P1 steps for 1 orbit", nT, "t_n", nT*10, "2 orbits steps", math.floor(2*TG/10))
V0={"radius":5.66e-4,"energy":1.28e-6,"period":9.07e-7,"pos_rel":38.7/r0}
pred={"radius(p=1, theory h/2)":h1/2,"energy(p=2)":V0["energy"]*rho**2,"period(p=2)":V0["period"]*rho**2,"pos_one_orbit_m(p=2)":V0["pos_rel"]*rho**2*aG}
for k,v in pred.items(): print(f"   pred {k}: {v:.4e}")
# E1
k=1.10; a=r0/(2-k*k); e=1-r0/a; ra=a*(1+e); T=2*math.pi*math.sqrt(a**3/MU); vp=k*vc
print(f"E1: a={a:.3f} e={e:.6f} ra={ra:.3f} T={T:.4f} steps1={math.floor(T+1e-9)} steps2={math.floor(2*T+1e-9)} omega_p*dt={vp/r0:.4e}")
# X1
k=1.42; eps=(k*k*vc*vc)/2-MU/r0; vinf=math.sqrt(2*eps); e=k*k-1; a=-MU/(2*eps)
print(f"X1: eps={eps:.4f} eps/(mu/r0)={eps/(MU/r0):.5f} vinf={vinf:.2f} e={e:.4f} a={a:.1f} steps={86400}")
# I1
k=0.98; eps=(k*k*vc*vc)/2-MU/r0; hmom=r0*k*vc; v2=2*(eps+MU/RE); vt=hmom/RE; vr=math.sqrt(v2-vt*vt)
a=-MU/(2*eps); e=1-k*k  # start at apoapsis: r0=a(1+e)
rp=a*(1-e)
# time from apoapsis to r=RE descending: E at apoapsis=pi; r=a(1-e cosE)
E=math.acos((1-RE/a)/e); M_ap=math.pi; M_hit=2*math.pi-(E-e*math.sin(E)) # descending after apoapsis: E in (pi,2pi)
E2=2*math.pi-E; M2=E2-e*math.sin(E2); n=math.sqrt(MU/a**3); tstar=(M2-math.pi)/n
print(f"I1: a={a:.3f} e={e:.6f} rp={rp:.3f} (below RE by {(RE-rp):.1f} m) v_r at RE={vr:.2f} m/s, v={math.sqrt(v2):.2f}, t*={tstar:.3f} s, flight-path angle={math.degrees(math.atan2(vr,vt)):.3f} deg")
print(f"I1: timing error per 100 m radial error = {100/vr:.3f} s")

# ---- leading-order modified-energy predictions ----
MU=3.986004418e14; RE=6378137.0; r0=RE+400e3; vc=math.sqrt(MU/r0)
def arc_lead(k, nu_lo, nu_hi, dt=1.0):
    eps=(k*k*vc*vc)/2-MU/r0; h=r0*k*vc; e=abs(k*k-1); p=h*h/MU
    nus=np.linspace(nu_lo,nu_hi,200001); r=p/(1+e*np.cos(nus)); rdot=math.sqrt(MU/p)*e*np.sin(nus)
    return dt/2*np.max(MU*np.abs(rdot)/r**2), eps
# E1 full orbit, start periapsis
L,eps=arc_lead(1.10,0,2*math.pi); print(f"E1 lead-order energy amplitude rel = {L/abs(eps):.4e}")
# I1: starts at apoapsis (nu=pi), descends to r=RE: nu from pi to nu_hit
k=0.98; h=r0*k*vc; p=h*h/MU; e=1-k*k; nu_hit=2*math.pi-math.acos((p/RE-1)/e)
L,eps=arc_lead(k,math.pi,nu_hit); print(f"I1 lead-order energy rel = {L/abs(eps):.4e} ; nu_hit={math.degrees(nu_hit):.2f}")
# X1: from periapsis to t=1 day ; nu at 1 day via hyperbolic Kepler
k=1.42; eps=(k*k*vc*vc)/2-MU/r0; A=MU/(2*eps); e=k*k-1; n=math.sqrt(MU/A**3); M=n*86400
H=math.asinh(M/e)
for _ in range(100): H-= (e*math.sinh(H)-H-M)/(e*math.cosh(H)-1)
nu=2*math.atan(math.sqrt((e+1)/(e-1))*math.tanh(H/2))
L,_=arc_lead(k,0,nu); print(f"X1 lead-order |deps|/(mu/r0) = {L/(MU/r0):.4e}; nu(1 day)={math.degrees(nu):.2f} deg, r={A*(e*math.cosh(H)-1)/1e3:.0f} km")
# pilot check of formula for X1-type: k=1.45
k=1.45; eps=(k*k*vc*vc)/2-MU/r0; A=MU/(2*eps); e=k*k-1; n=math.sqrt(MU/A**3); M=n*86400
H=math.asinh(M/e)
for _ in range(100): H-= (e*math.sinh(H)-H-M)/(e*math.cosh(H)-1)
nu=2*math.atan(math.sqrt((e+1)/(e-1))*math.tanh(H/2)); L,_=arc_lead(k,0,nu); print(f"pilot k=1.45 lead-order {L/(MU/r0):.4e} (measured 2.188e-04)")
# pilot impact k=0.97 lead energy for reference
k=0.97; h=r0*k*vc; p=h*h/MU; e=1-k*k; nu_hit=2*math.pi-math.acos((p/RE-1)/e); L,eps=arc_lead(k,math.pi,nu_hit); print(f"pilot k=0.97 lead energy rel {L/abs(eps):.4e}")
