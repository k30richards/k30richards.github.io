# k30richards.github.io

Kobe Richards' personal portfolio site: one long page that introduces him, his experience, and his projects to recruiters and hiring managers.

## Language

### Page structure

**Section**:
One of the page's top-level blocks, read in order: the Hero, About, Experience, Projects, and Contact.
_Avoid_: Panel, block, slide, page

**Hero**:
The opening Section with Kobe's name, his one-line intro, and the two calls to action. It is already on screen when the page loads.
_Avoid_: Header, banner, splash

**Projects section**:
The Section listing Kobe's projects, one Panel per project.
_Avoid_: Work, Selected work

**Contact section**:
The closing Section with what roles he is open to and his contact links.
_Avoid_: Footer

**Panel**:
A self-contained container holding one piece of a Section's content, such as the bio, the facts, one role, or one project. Every piece of content in About, Experience, Projects and Contact lives in a Panel. The Hero has no Panels: its content sits directly over the Constellation.
_Avoid_: Card, box, tile, storage space

**Toolkit**:
The Panel in About that groups the tools Kobe already names in his bio by category.
_Avoid_: Skills list, tech stack

**Timeline**:
The vertical line in Experience that the role Panels hang off, in date order.
_Avoid_: Roles list

**Quick look**:
The row of links in the Hero that open each Section as a Section pop-up. Without JavaScript they jump to the Section instead. (Sandbox experiment, `sandbox/section-popups` only.)
_Avoid_: Hero nav, shortcuts

**Section pop-up**:
A dialog over the dimmed page showing one Section in compact form: a short summary first with "Read more" for the full text, plus that Section's controls (role tabs, topic chips, fact tiles). Its arrow moves to the next Section's pop-up, wrapping from Contact to About. Built from the Section's own content, so nothing is written twice. (Sandbox experiment.)
_Avoid_: Modal, lightbox, overlay

**Summary**:
The short version of a long piece of text (the bio, a role, a project), kept beside it in a `<template class="summary">` and shown first in a Section pop-up.
_Avoid_: Excerpt, blurb, TL;DR

### Background

**Constellation**:
The animated field of drifting nodes that connect to their neighbours, sitting behind every Section and staying in place while the page scrolls.
_Avoid_: Particles, network background, canvas

### Motion

**Reveal**:
A Panel or a Section heading fading in and rising into place as it scrolls into view, following the visitor's scroll position, so scrolling back up plays it in reverse.
_Avoid_: Entry, entrance, scroll animation, Section Transition

**Active Section**:
The Section the visitor is currently reading, highlighted in the navigation.
_Avoid_: Current page, selected tab
