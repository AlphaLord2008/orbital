"""Exact two-body solutions used ONLY by the v0.1.1 pilot script. Superseded by orbital.analytic."""
import math
import numpy as np
def elements(r, v, mu):
    r=np.asarray(r,float); v=np.asarray(v,float)
    rn=np.hypot(*r); v2=v@v; rv=r@v
    eps=v2/2-mu/rn; h=r[0]*v[1]-r[1]*v[0]
    evec=((v2-mu/rn)*r - rv*v)/mu; e=math.hypot(*evec); a=-mu/(2*eps)
    w=math.atan2(evec[1],evec[0])
    nu0=math.atan2(r[1],r[0])-w
    return dict(eps=eps,h=h,e=e,a=a,w=w,nu0=nu0)
def _kepler_E(M,e):
    E=M if e<0.8 else math.pi
    for _ in range(60):
        f=E-e*math.sin(E)-M; d=1-e*math.cos(E); dE=-f/d; E+=dE
        if abs(dE)<1e-15: break
    return E
def _kepler_H(M,e):
    H=math.asinh(M/e)
    for _ in range(100):
        f=e*math.sinh(H)-H-M; d=e*math.cosh(H)-1; dH=-f/d; H+=dH
        if abs(dH)<1e-15*max(1,abs(H)): break
    return H
def state_at(el, t, mu):
    e,a,w,nu0=el['e'],el['a'],el['w'],el['nu0']
    if e<1:
        E0=2*math.atan2(math.sqrt(1-e)*math.sin(nu0/2), math.sqrt(1+e)*math.cos(nu0/2))
        M=E0-e*math.sin(E0)+math.sqrt(mu/a**3)*t
        E=_kepler_E(math.fmod(M,2*math.pi),e)
        xp=a*(math.cos(E)-e); yp=a*math.sqrt(1-e*e)*math.sin(E)
    else:
        A=-a
        H0=2*math.atanh(math.sqrt((e-1)/(e+1))*math.tan(nu0/2))
        M=e*math.sinh(H0)-H0+math.sqrt(mu/A**3)*t
        H=_kepler_H(M,e)
        xp=A*(e-math.cosh(H)); yp=A*math.sqrt(e*e-1)*math.sinh(H)
    c,s=math.cos(w),math.sin(w)
    return np.array([c*xp-s*yp, s*xp+c*yp])
