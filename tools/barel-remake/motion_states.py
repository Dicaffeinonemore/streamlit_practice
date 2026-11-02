"""Barel states without a twenty-frame source motion: hurt, knockdown/get-up, grabbed, death, victory,
cast and the ultimate's opening. Each motion() returns frames at the game's own count; build.py picks them
1:1. Registers into motion.MOTIONS on import."""
import math

import numpy as np

import motion as M
from motion import (ANK_B, ANK_F, BASE_ANGLE, REST_HAND, WRI_B, cloth, dash_pose, two_hand)

PRONE_CAPE = -25          # pre-rotation cape bend so it lies along the body once the body is horizontal


def base(**kw):
    q = dict(root=(0, 0), lean=0, foot_f=tuple(ANK_F), foot_b=tuple(ANK_B), hand_f=REST_HAND, sword_ang=BASE_ANGLE)
    q.update(kw)
    return q


def dressed(f, q, c=2.0, amp=2.0, speed=1.0, lift=0.0):
    q = dict(q)
    q.update(cloth(f, bend=c, amp=amp, speed=speed, lift=lift))
    return q


def kneel(**kw):
    """Near knee on the floor, far foot planted forward."""
    q = base(root=(-2, 38), foot_f=(84, 230), foot_f_ang=25, foot_b=(152, ANK_B[1]))
    q.update(kw)
    return q


def lying(angle, sword_world, **kw):
    """Straight body rotated about the hips and rested on the floor (-90 on the back, +90 face down)."""
    q = base(root=(0, 2), sword_ang=sword_world - angle, body=dict(angle=angle, ground=True))
    q.update(kw)
    return q


def lying_cloth(f, q, c=PRONE_CAPE, amp=1.0):
    return dressed(f, q, c=c, amp=amp, speed=0.5)


# ---------------------------------------------------------------- hurt: 1 neutral, 2-6 high, 7-11 low, 12 recovery
def m_hurt():
    rows = [
        (base(), 2),
        (base(root=(-5, 1), lean=-16, head=-8, hand_f=(100, 150), sword_ang=52, hand_b=(168, 100)), 18),
        (base(root=(-7, 2), lean=-22, head=-12, hand_f=(98, 152), sword_ang=56, hand_b=(170, 96)), 24),
        (base(root=(-6, 2), lean=-16, head=-8, hand_f=(102, 150), sword_ang=50, hand_b=(165, 110)), 18),
        (base(root=(-4, 1), lean=-9, head=-4, hand_f=(105, 149), sword_ang=46, hand_b=(160, 128)), 10),
        (base(root=(-2, 0), lean=-4, hand_f=(107, 147), sword_ang=44), 5),
        (base(root=(-3, 8), lean=16, head=8, hand_f=(114, 158), sword_ang=64, hand_b=(150, 150)), -6),
        (base(root=(-4, 10), lean=22, head=12, hand_f=(116, 162), sword_ang=70, hand_b=(148, 156)), -8),
        (base(root=(-3, 8), lean=16, head=8, hand_f=(114, 158), sword_ang=60, hand_b=(150, 150)), -4),
        (base(root=(-2, 5), lean=9, hand_f=(111, 153), sword_ang=50), 0),
        (base(root=(-1, 2), lean=4, hand_f=(109, 149), sword_ang=42), 2),
        (base(root=(0, 1), lean=-1), 2),
    ]
    return dict(frames=[dict(q=dressed(i + 1, q, c)) for i, (q, c) in enumerate(rows)])


# ---------------------------------------------------------------- knockdown (10) and the separate get-up sheet (6)
def _knockdown_rows():
    air_legs = dict(foot_f=(128, 214), foot_b=(152, 206))
    return [
        (base(root=(-6, 0), lean=-26, head=-12, hand_f=(98, 150), sword_ang=82, hand_b=(174, 90)), 26),
        (base(root=(0, 0), lean=-10, hand_f=(104, 140), sword_ang=100, hand_b=(172, 88), body=dict(angle=-30), **air_legs), 30),
        (base(root=(0, 0), lean=-6, hand_f=(110, 132), sword_ang=110, hand_b=(170, 92), body=dict(angle=-62), **air_legs), 20),
        (lying(-84, 4, root=(0, 4)), "lie"),
        (lying(-90, 2, body=dict(angle=-90, ground=True, dy=-3)), "lie"),
        (lying(-90, 2), "lie"),
    ]


def _rise_rows():
    return [
        (kneel(lean=34, head=10, hand_f=(102, 226), sword_ang=8, hand_b=(150, 175)), 4),
        (kneel(lean=14, hand_f=(150, 176), sword_ang=88, sword_clip=241, hand_b=two_hand((150, 176), 88)), 4),
        (base(root=(-1, 18), lean=8, foot_f=(100, 226), hand_f=(146, 160), sword_ang=80, hand_b=(154, 150)), 3),
        (base(), 2),
    ]


def _frames(rows):
    out = []
    for i, (q, c) in enumerate(rows):
        out.append(dict(q=lying_cloth(i + 1, q) if c == "lie" else dressed(i + 1, q, c, amp=2.5)))
    return out


def m_down():
    return dict(frames=_frames(_knockdown_rows() + _rise_rows()))


def m_getup():
    curl = (lying(-62, 6, root=(0, 30)), "lie")
    return dict(frames=_frames([_knockdown_rows()[-1], curl] + _rise_rows()))


# ---------------------------------------------------------------- grabbed: jolt, then a nine-frame struggle loop
def m_grabbed():
    frames = [dict(q=dressed(1, base(root=(4, 2), lean=14, hand_f=(112, 150), sword_ang=70, hand_b=(166, 118)), -8, amp=3))]
    for i in range(9):
        ph = 2 * math.pi * i / 9
        s = math.sin(ph)
        q = base(root=(-2 + 3 * s, 2), lean=-6 + 8 * s, head=-6 * s, hand_f=(106 + 4 * s, 150), sword_ang=80 + 10 * s,
                 hand_b=(156 + 8 * math.cos(ph), 112 + 6 * s))
        q.update(cape=dict(bend=10 + 8 * s, amp=3, phase=ph), tabard=dict(bend=4 * s, amp=1.5, phase=ph),
                 scarf=dict(bend=6 * s, amp=1.5, phase=ph))
        frames.append(dict(q=q))
    return dict(frames=frames)


# ---------------------------------------------------------------- death: stagger, kneel on the planted sword, fall face down
def m_death():
    knee_pivot = (128, 236)
    rows = [
        (base(root=(-5, 1), lean=-18, head=-10, hand_f=(100, 150), sword_ang=78, hand_b=(168, 104)), 18),
        (base(root=(-3, 14), lean=-4, head=4, hand_f=(108, 168), sword_ang=84, hand_b=(156, 150)), 6),
        (kneel(lean=10, head=10, hand_f=(150, 176), sword_ang=88, sword_clip=241, hand_b=two_hand((150, 176), 88)), 4),
        (kneel(lean=24, head=20, hand_f=(148, 180), sword_ang=88, sword_clip=241, hand_b=(152, 186)), 2),
        (kneel(lean=24, head=20, hand_f=(146, 184), sword_ang=88 - 25, body=dict(angle=25, pivot=knee_pivot, ground=True)), 0),
        (kneel(lean=20, head=16, hand_f=(146, 184), sword_ang=10 - 55, body=dict(angle=55, pivot=knee_pivot, ground=True)), -10),
    ]
    frames = _frames(rows)
    for i, (c, amp) in enumerate(((-34, 2.0), (-30, 1.5), (-26, 1.0), (-24, 0.6))):
        frames.append(dict(q=dressed(7 + i, lying(86 if i == 0 else 90, 4), c, amp=amp, speed=0.4)))
    return dict(frames=frames)


# ---------------------------------------------------------------- victory loop: sword planted, both hands on the pommel
def m_victory():
    frames = []
    for i in range(10):
        b = round(1 - math.cos(2 * math.pi * i / 10))
        ph = 2 * math.pi * i / 10
        hand = (150, 128 + b)
        q = base(root=(0, b), lean=-2, head=-4, hand_f=hand, sword_ang=90, sword_clip=241, hand_b=two_hand(hand, 90, 9))
        q.update(cape=dict(bend=6 + 4 * math.sin(ph), amp=3, phase=ph), tabard=dict(amp=1, phase=ph),
                 scarf=dict(amp=1.2, phase=ph, bend=3))
        frames.append(dict(q=q))
    return dict(frames=frames)


# ---------------------------------------------------------------- cast: sword raised to the sky, lightning at 380 ms
CAST_GLOW = {4: .35, 5: .7, 6: 1.0, 7: 1.0}


def m_cast():
    up = dict(hand_f=(126, 58), sword_ang=-88, lean=-6, head=-10, hand_b=two_hand((126, 58), -88))
    rows = [
        (base(hand_f=(118, 112), sword_ang=-20, lean=-2), 4, 0),
        (base(hand_f=(122, 84), sword_ang=-60, lean=-4, head=-4, hand_b=two_hand((122, 84), -60)), 6, 0),
        (base(**up), 8, -4), (base(**up), 8, -6), (base(root=(1, 0), **up), 10, -8), (base(**up), 12, -10),
        (base(root=(0, 1), **up), 18, -10),
        (base(hand_f=(122, 90), sword_ang=-50, lean=-4, hand_b=two_hand((122, 90), -50)), 8, 0),
        (base(hand_f=(114, 126), sword_ang=10), 4, 0),
        (base(), 2, 0),
    ]
    return dict(frames=[dict(q=dressed(i + 1, q, c, amp=2.4, lift=lift)) for i, (q, c, lift) in enumerate(rows)])


# ---------------------------------------------------------------- ultimate opening (0-620 ms): gather, then the dash
SPECIAL0_GLOW = {2: .2, 3: .4, 4: .6, 5: .8, 6: 1.0, 7: 1.0}


def m_special0():
    raised = lambda g_lean: base(hand_f=(134, 108), sword_ang=-90, lean=g_lean, hand_b=two_hand((134, 108), -90))
    frames = [dict(q=dressed(1, base(), 2))]
    for i, lean in enumerate((-1, -2, -3, -4, -4, -5)):
        frames.append(dict(q=dressed(i + 2, raised(lean), 6 + 2 * i, amp=2.5, lift=-i)))
    dash = M.m_dash()["frames"]
    frames += [dict(q=dash[2]["q"]), dict(q=dash[4]["q"]), dict(q=dash[8]["q"])]
    return dict(frames=frames)


STATE_MOTIONS = dict(hurt=m_hurt, down=m_down, getup=m_getup, grabbed=m_grabbed, death=m_death, victory=m_victory,
                     cast=m_cast, special0=m_special0)
M.MOTIONS.update(STATE_MOTIONS)
