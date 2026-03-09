# Roberto 5-Minute Script + Q&A

## 5-Minute Main Script

### Core framing (say this early)
Roberto is **user-centered at the front door** and **rescuer-centered in operations**. Citizens are the signal; rescuers are the response engine — Roberto connects both in one real-time workflow.

### Self Intro (0:00-0:20)
Hi, I'm **Xy**. I am a full-stack developer at **HeyApril**, a US startup building a tax SaaS optimizer for creators. I previously worked as an AI Engineer Intern at **AIFirst** and as an AI QA Engineer at **Boost Capital**, a Singapore startup.

### Slide 1 - The Problem (0:20-0:45)
Good day everyone. Flooding affects millions of Filipinos every year. During heavy rain, minutes matter, but people often do not get precise, local guidance fast enough.

### Slide 2 - The Gap (0:45-1:10)
Today, response is fragmented. Alerts are city-wide, reports are manual, and visibility is limited. People who can help nearby are often disconnected from those who need help.

### Slide 3 - Roberto (0:50-1:10)
This is why we built **Roberto**: a disaster response network for Metro Manila that connects community reporting, operational coordination, and risk intelligence.

### Slide 4 - Coverage Intelligence (1:10-1:45)
Roberto combines open data from **NOAH**, **DPWH**, and **OCHA**.
- NOAH tells us flood hazard severity.
- DPWH shows flood-control project coverage and progress.
- OCHA gives city boundary context.

This helps communities see where risk is high and where protection is still incomplete.

### Slide 5 - Incident Command (1:45-2:20)
When an incident starts, the flow is clear: **Ping -> Verified -> Prioritized -> Assigned -> Resolved**.

Citizens report from location. Coordinators verify and prioritize. Responders execute and close with field notes. The system keeps human accountability at every step.

### Slide 6 - Community Network (2:20-2:45)
Roberto also supports community-to-community assistance. People can discover nearby helpers and connect. This is digital bayanihan during climate stress.

### Slide 7 - AI Guidance (2:45-3:20)
For each ping, Roberto generates local guidance using hazard level, weather context, and city context. If AI confidence is low, Roberto automatically switches to conservative fallback guidance. So the user still gets safe, actionable advice.

### Slide 8 - Coordinator View (3:20-3:45)
Coordinators get KPI visibility, status filtering, and a full audit trail. This improves speed while keeping decisions transparent and traceable.

### Slide 9 - Responder View (3:45-4:05)
Responders see exact incident coordinates, nearby critical facilities, and map-linked context to act faster in the field.

### Slide 10 - Accessibility (4:05-4:25)
Roberto is bilingual in English and Filipino so people can understand instructions under pressure. In disasters, clarity is life-saving.

### Slide 11 - Architecture (4:25-4:40)
The stack is practical and reliable: React + Mapbox, Express + SQLite, SSE realtime updates, role-based access, and open public data.

### Slide 12 - Closing Answer (4:40-5:00)
Our answer to the challenge is simple: technology helps us live in right relationship with natural systems when it starts from nature's signals, translates risk into local human action, and strengthens community learning after every event.

---

## Fast Q&A Bank (Easy English)

## Coverage Score Defense (Verbatim)

1. What it is: "Coverage score is an infrastructure readiness index, not a flood prediction score."
2. How it works: "It combines spatial protection overlap (raw_coverage_ratio) with project completion (avg_progress) into effective_coverage_score."
3. Why it matters: "It tells us where hazard is high but practical protection is still weak, so coordinators can pre-position teams and prioritize vulnerable areas first."

### 1) "Is this replacing government responders?"
No. Roberto supports them. It improves coordination and local visibility, but final decisions stay with human responders and coordinators.

### 2) "Why use AI here?"
AI is used for faster local guidance, not final authority. If confidence is low, the system falls back to safe, conservative instructions.

### 3) "What makes this climate-tech, not just a reporting app?"
It combines hazard science, infrastructure coverage, and operational response in one workflow. It helps people adapt to flood behavior, not just report incidents.

### 4) "Can this scale outside Metro Manila?"
Yes. The model is transferable if local boundary, hazard, and infrastructure datasets are available.

### 5) "What is the biggest impact?"
Faster, clearer action at the neighborhood level during flood events, with better accountability and community coordination.
