# **Product Plan — Outreach Intelligence**

## **Olivia Outreach Concierge**

**Version:** 1.1  
 **Status:** Experimental Capability / Pipeline Definition  
 **Owner:** Leandro Disconzi  
 **Date:** 2026-08-07

---

## **1\. Product Concept**

**Olivia Outreach Concierge** is an agent-driven research and relationship-intelligence pipeline designed to prepare a deeply contextualised introduction between Olivia and a person or organisation.

The pipeline does not begin by generating a message.

It begins by asking:

**Who is this person or organisation, what world do they operate in, what can we legitimately understand about that world, and is there a meaningful reason for Olivia to enter it?**

Only after that understanding has been established should Olivia formulate a possible bridge and prepare an outreach package.

The objective is not automated outreach.

The objective is **relevant outreach based on genuine understanding**.

---

## **2\. Core Principle**

**Research before messaging. Understanding before personalisation. Alignment before outreach. Human judgement before delivery.**

Personalisation must never mean simply inserting a person’s name, company or recent post into a generic template.

A genuinely personalised outreach experience should demonstrate that Olivia has understood something meaningful about the person’s professional world.

---

## **3\. Strategic Objective**

The pipeline should:

* reduce the time required to understand a potential relationship;  
* transform fragmented public information into structured knowledge;  
* identify genuine areas of intellectual or operational alignment;  
* distinguish evidence from interpretation;  
* generate a respectful bridge between Olivia and the lead’s world;  
* produce a useful asset before asking for attention;  
* maintain a complete research trail;  
* allow human review before any external communication;  
* learn from the results of each outreach.

---

# **4\. Pipeline Architecture**

The pipeline consists of eight logical stages.

INPUT  
  ↓  
1\. SOURCE CAPTURE  
  ↓  
2\. DISCOVERY & ENRICHMENT  
  ↓  
3\. PROFILE SYNTHESIS  
  ↓  
4\. CONTEXT & HYPOTHESIS ANALYSIS  
  ↓  
5\. ALIGNMENT / QUALIFICATION  
  ↓  
6\. BRIDGE CREATION  
  ↓  
7\. READY-PACK ASSEMBLY  
  ↓  
8\. HUMAN OUTREACH  
  ↓  
OUTCOME / LEARNING  
---

# **5\. Stage 1 — Source Capture**

### **Objective**

Create a reliable starting context from the information supplied by the user.

### **Possible inputs**

* LinkedIn profile  
* LinkedIn post  
* Instagram profile  
* Instagram post  
* website  
* company page  
* article  
* publication  
* document  
* manually supplied notes  
* previous conversation context

### **Outputs**

* source capture Markdown;  
* extracted text;  
* discovered URLs;  
* source metadata;  
* initial identity candidates.

### **Requirements**

The agent must preserve the distinction between:

* information directly extracted;  
* information supplied by the user;  
* information discovered later.

No interpretation should be presented as source material.

---

# **6\. Stage 2 — Discovery & Enrichment**

### **Objective**

Expand the initial context using reliable public sources.

Research may include:

* professional biography;  
* company information;  
* academic work;  
* dissertations;  
* publications;  
* books;  
* interviews;  
* talks;  
* awards;  
* professional projects;  
* frameworks;  
* methodologies;  
* public statements;  
* recurring themes;  
* relevant organisational context.

### **Evidence requirement**

Every significant factual claim should have provenance.

Each finding should preferably contain:

Claim  
Source  
Source type  
Date  
Confidence  
Notes

Confidence levels:

* **Verified**  
* **Strongly supported**  
* **Plausible**  
* **Unverified**  
* **Conflicting**

Conflicting information must not be silently resolved.

---

# **7\. Stage 3 — Profile Synthesis**

The agent creates a structured **Lead Profile**.

### **Required sections**

#### **Professional Identity**

Who the person is professionally.

#### **Career & Experience**

Relevant trajectory and current position.

#### **Expertise**

Known areas of competence.

#### **Intellectual / Professional Themes**

What they repeatedly talk about, research or build.

#### **Vocabulary & Framing**

The language and conceptual framing they naturally use.

#### **Values & Principles**

Only where reasonably supported by public evidence.

#### **Current Context**

What appears to be relevant to their current professional situation.

#### **Open Questions**

What Olivia still does not know.

---

# **8\. Stage 4 — Context & Hypothesis Analysis**

This stage is deliberately different from “pain-point detection.”

Olivia must never claim to know someone’s internal problems merely from public information.

Every interpretation must be classified as:

### **FACT**

Directly supported by evidence.

### **INFERENCE**

A reasonable interpretation based on multiple pieces of evidence.

### **HYPOTHESIS**

A possible concern, need, aspiration or opportunity that requires validation.

Example:

**FACT**

The professional repeatedly discusses organisational knowledge preservation.

**INFERENCE**

Knowledge continuity appears to be an important theme in their work.

**HYPOTHESIS**

They may be interested in technologies that preserve institutional knowledge without removing human expertise.

This distinction is mandatory.

---

# **9\. Stage 5 — Alignment & Qualification**

The system compares the lead’s professional world with Olivia’s capabilities and principles.

Possible alignment dimensions include:

* organisational knowledge;  
* operational intelligence;  
* human expertise;  
* workplace learning;  
* responsible AI;  
* process improvement;  
* organisational memory;  
* data readiness;  
* automation;  
* governance;  
* decision support;  
* industry-specific challenges.

### **Critical requirement**

The system must be allowed to conclude:

**Insufficient alignment — do not pursue outreach.**

This is a successful pipeline outcome, not a failure.

### **Qualification output**

Alignment:  
Strong / Moderate / Weak / Insufficient

Evidence:  
...

Potential bridge:  
...

Unresolved questions:  
...

Recommended action:  
Proceed / Research further / Do not pursue

No numerical lead score should be introduced until sufficient real-world cases exist to justify one.

---

# **10\. Stage 6 — Bridge Creation**

The Bridge Document is the intellectual heart of the pipeline.

It should answer:

**Why might this person and Olivia have something meaningful to talk about?**

The Bridge Document should:

* begin from the lead’s world;  
* demonstrate genuine understanding;  
* identify relevant intersections;  
* explain Olivia only where relevant;  
* avoid generic marketing language;  
* avoid exaggerated claims;  
* avoid pretending to know the lead’s needs;  
* make collaboration an invitation rather than an assumption.

The desired feeling is:

**“Someone actually took the time to understand what I do.”**

not:

**“An AI generated a personalised sales pitch for me.”**

---

# **11\. Stage 7 — Ready-Pack Assembly**

Where appropriate, Olivia may generate a contextualised package.

Possible components:

/lead/  
    source/  
    discovery/  
    profile/  
    alignment/  
    bridge/  
    outreach/  
    assets/  
    website/  
    logs/

Potential outputs:

* Lead Profile;  
* Bridge Document;  
* HTML experience;  
* PDF versions;  
* visual identity adaptation;  
* one-minute explanation/video script;  
* outreach draft.

The Ready Pack is optional.

Not every lead requires a website.

The pipeline should choose the lightest artifact capable of communicating the value of the research.

---

# **12\. Stage 8 — Human Outreach**

Olivia prepares:

* recommended channel;  
* message;  
* context;  
* reason for outreach;  
* optional resource link;  
* suggested follow-up.

The human decides:

* whether to send;  
* when to send;  
* whether to modify;  
* whether to attach/share the resource.

No autonomous external outreach should occur in the initial implementation.

---

# **13\. Outcome & Learning**

After outreach, the pipeline may record:

* sent;  
* viewed/opened where technically available;  
* replied;  
* positive response;  
* neutral response;  
* negative response;  
* no response;  
* meeting;  
* opportunity;  
* collaboration;  
* reason for rejection where known.

The system should compare:

Research  
↓  
Bridge  
↓  
Message  
↓  
Response  
↓  
Conversation  
↓  
Outcome

This creates an evidence base for improving the pipeline.

---

# **14\. Human Time Target**

Initial target:

**≤ 30 minutes of human attention per qualified lead.**

The target should not be achieved by reducing research quality.

Instead:

* agents perform repetitive discovery;  
* agents organise evidence;  
* agents identify gaps;  
* humans validate interpretation;  
* humans approve the bridge;  
* humans control outreach.

As repeated cases reveal stable patterns, selected stages may become more automated.

---

# **15\. Initial Evaluation Program**

Before declaring the pipeline production-ready, run approximately **5–10 diverse outreach cases**.

For every case record:

* input;  
* sources;  
* research duration;  
* agent actions;  
* human interventions;  
* outputs;  
* alignment decision;  
* outreach message;  
* outcome;  
* errors;  
* unnecessary steps;  
* missing information.

After the first cases, review:

What did every case need?

What only one case needed?

Which steps produced real value?

Which steps created noise?

Where did the agent hallucinate?

Where did human judgement materially improve the result?

Only then should the orchestration be hardened.

---

# **16\. Product Differentiation**

The pipeline is not intended to compete primarily with mass outreach or lead-generation automation.

Its differentiation is:

**Context before contact.**

Traditional outreach:

Lead → Template → Message

Olivia Outreach Concierge:

Lead  
 ↓  
Research  
 ↓  
Evidence  
 ↓  
Understanding  
 ↓  
Context  
 ↓  
Alignment  
 ↓  
Bridge  
 ↓  
Human judgement  
 ↓  
Meaningful introduction  
 ↓  
Learning

The system therefore treats outreach as an extension of organisational intelligence rather than a messaging problem.

---

# **17\. Long-Term Possibility**

If validated across multiple use cases, Outreach Concierge could become a reusable Olivia capability for:

* business development;  
* partnerships;  
* investor relationships;  
* enterprise introductions;  
* strategic partnerships;  
* professional networking;  
* customer discovery;  
* ecosystem development;  
* research collaborations.

The long-term product principle remains:

**Don’t automate the message. Improve the understanding that makes the message worth sending.**

