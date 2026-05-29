# ATRPG PRD

## Product Summary

ATRPG is a browser-based tabletop roleplay platform where a human DM hosts a live text campaign with human players and AI-controlled characters. The product turns each session into reusable creative assets: character portraits, post-session illustrations, a narrative recap, and a short video.

## Primary Users

- DM: creates campaigns, configures rooms, curates AI suggestions, triggers post-session content
- Player: creates a character, joins rooms, participates in live sessions
- Operator: configures provider settings, monitors job health, debugs failures

## Core User Flow

1. DM creates a campaign and opens a room
2. Players create characters and generate portraits
3. Session runs in a real-time text room
4. AI co-DM suggests narration, NPC reactions, and scene progression
5. Story ledger stores structured events
6. After the session, DM generates illustrations, a recap novel, and a short video

## V1 Boundaries

Included:

- email-code login
- campaign creation
- character creation with portrait generation trigger
- text-only live room
- structured story ledger
- async media jobs

Excluded:

- voice or video call
- battle map or VTT grid
- advanced dice engine
- marketplace, billing, or public sharing feed

## Product Requirements

- Real-time room interaction must stay responsive while media jobs run asynchronously
- AI output that changes story state must pass through DM confirmation or explicit user action
- Portrait assets must be reusable as the character anchor for later illustration and video jobs
- Job history and room history must survive refresh and re-login

