---
title: "How to Read These Docs"
description: "A guide to understanding Hectoday HTTP's documentation structure"
order: 1
draft: true
---

These docs are structured as **concept → practice → reference**.

Each chapter builds on the previous one, adding a single idea. You can stop at any point and still understand everything you've read.

## The Structure

### Part 1: Mental Models (Chapters 1-2)

Before you write code, you need a way to **think about HTTP**. These chapters build a mental model:

- How requests and responses work
- Why direction and perspective matter
- What "facts before decisions" means

**Read these even if you're impatient.** The framework's API only makes sense with this model.

### Part 2: Core Concepts (Chapters 3-6)

These chapters introduce the framework's primitives:

- Handlers (return responses)
- Facts (raw inputs, validation)
- Guards (allow/deny decisions)

Each concept gets its own chapter. **Nothing is assumed.** If you read linearly, you'll never encounter an unexplained term.

### Part 3: Composition (Chapters 7-9)

Once you understand the pieces, you'll see how they compose:

- The full request lifecycle
- Error handling
- Building larger APIs

This is where the framework's constraints start to feel like leverage.

### Part 4: Real Concerns (Chapters 10-12)

Practical chapters about:

- Security
- Static files
- Runtime differences (Deno vs Bun vs Workers)

These apply the mental model to real problems.

### Part 5: Reference (Chapters 13-15)

- Testing strategies
- Complete API reference
- Philosophy revisited

Use these when you need details, not understanding.

## How to Navigate

### If You're Exploring

Start at **Chapter 1: A Mental Model of HTTP**. Read sequentially. Each chapter is short.

### If You Need Something Specific

Jump to the reference (Chapter 14). But if the API feels confusing, back up to the concept chapters.

### If You're Experienced

Skim **Chapter 1-2** to understand the mental model. Then jump to **Chapter 7: The Request Lifecycle** for the full picture.

### If You're Skeptical

Read **Chapter 1: A Mental Model** and **Chapter 15: Philosophy**. If these resonate, read the rest. If not, this framework isn't for you—and that's fine.

## What These Docs Are Not

### Not a Tutorial

You won't find "build a blog in 10 minutes." These docs explain **how the framework thinks**, not how to accomplish tasks quickly.

Once you understand the model, tasks become obvious.

### Not a Cookbook

You won't find recipes like "how to handle file uploads" or "how to add CORS." Instead, you'll learn the primitives, and recipes become trivial.

(We do provide helpers for common patterns—listed separately at the bottom of the documentation index—but they're documented as **examples of composition**, not magical solutions.)

### Not Comprehensive on First Read

You don't need to read everything to start. **Read until you understand the model**, then write code. Return to the docs when you need specifics.

## Key Terms You'll Encounter

These terms have precise meanings in Hectoday HTTP:

**Fact**: Information extracted or computed, but not acted upon. Examples: raw inputs, validation results.

**Decision Boundary**: A place where the request can end. Only two exist: guards and handlers.

**Guard**: A function that decides whether a request may continue. Returns `{ allow: true }` or `{ deny: Response }`.

**Handler**: A function that returns a `Response`. The end of every successful request.

**Context (`c`)**: The object passed to guards and handlers. Contains request, raw inputs, validation results, and locals.

**Locals**: Request-scoped data accumulated from `onRequest` and guards. Never mutated, always merged forward.

## Reading Tips

### Linear First, Random Later

On first read, go **sequentially**. The chapters assume you've seen the previous ones.

After you've read through once, use the docs as a reference. Jump around freely.

### Code First, Explanation Second

Each chapter shows code **before** explaining it. Try to understand the code yourself first. Then read the explanation.

This mirrors how you'll use the framework: you'll see code, and it should make sense without extensive docs.

### When Something Feels Wrong

If an API feels awkward or verbose, **that's often intentional**. The framework optimizes for explicitness, not brevity.

If you find yourself wanting magic, re-read **Chapter 9: Composition** and **Chapter 15: Philosophy**. The verbosity often disappears when you compose primitives.

## What Success Looks Like

You'll know you understand Hectoday HTTP when:

1. You can **trace a request** from arrival to response by reading handler code
2. You know **exactly** where decisions happen (guards and handlers, nowhere else)
3. You can **predict** whether a line of code might end the request (only `return` statements in guards/handlers)
4. You think of validation as **producing facts**, not controlling flow

When these feel natural, you've internalized the model. The rest is just syntax.

## A Note on Length

These docs are **detailed but not long**. Each chapter is short. We prefer:

- One idea per chapter
- Code before prose
- Precision over brevity

You can read the core chapters (1-9) in under an hour. But the ideas will change how you think about HTTP.

## Ready?

Start with [Chapter 1: A Mental Model of HTTP](./a-mental-model-of-http).

Or jump to [Installation](./installation) if you want to start coding immediately.
