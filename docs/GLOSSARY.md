# k30richards.github.io

Kobe Richards' personal portfolio site: one long page that introduces him, his experience, and his projects to recruiters and hiring managers.

## Language

### Page structure

**Section**:
One of the page's top-level blocks, read in order: the Hero, About, Experience, and Projects. (On `sandbox/section-popups` there is no Contact section; the contact links sit in the Hero.)
_Avoid_: Panel, block, slide, page

**Hero**:
The opening Section with Kobe's name, his one-line intro, the chips, the Section buttons and his contact links. It is already on screen when the page loads, and once the Section pop-ups are built it is the whole page.
_Avoid_: Header, banner, splash

**Projects section**:
The Section listing Kobe's projects, one Panel per project.
_Avoid_: Work, Selected work

**Panel**:
A self-contained container holding one piece of a Section's content, such as the bio, the facts, one role, or one project. Every piece of content in About, Experience and Projects lives in a Panel. The Hero has no Panels: its content sits directly over the Constellation.
_Avoid_: Card, box, tile, storage space

**Toolkit**:
The Panel in About that groups the tools Kobe already names in his bio by category.
_Avoid_: Skills list, tech stack

**Timeline**:
The vertical line in Experience that the role Panels hang off, in date order.
_Avoid_: Roles list

**Section button**:
One of the Hero's About, Experience and Projects buttons. Each opens its Section pop-up; without JavaScript it jumps to the Section on the long page instead. (Sandbox experiment, `sandbox/section-popups` only.)
_Avoid_: Quick look, Hero nav, shortcuts

**Section pop-up**:
A dialog over the dimmed Hero showing one Section's content in full, with no "Read more". About is a single page; Experience and Projects have one tab per role or project. Previous and Next arrows step through the Sections in order without wrapping (About has no Previous, Projects no Next), and a link to `#about`, `#experience` or `#work` opens that pop-up on arrival. Built from the Section's own content, so nothing is written twice. (Sandbox experiment.)
_Avoid_: Modal, lightbox, overlay

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
