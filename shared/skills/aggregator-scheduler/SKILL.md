---
name: aggregator-scheduler
triggers: [news, market, trend, scout, poll, schedule, interval, aggregator, feed, topics, made]
required_connectors: [serpapi, exa, tavily]
---

# Aggregator & Auto-Scheduler Skill

When creating scheduled feeds, news monitors, or topic aggregators:
1. **Archetype:** Use `aggregator` with `list_aggregator` + optional `trigger_button` for manual refresh + `status_strip` for last poll health.
2. **Scheduling:** Set explicit `poll_interval_ms` or `schedule_interval` (`15m | 30m | 2h | 6h | daily | off`).
3. **Reconciliation:** Active aggregators **add** fresh high-velocity items and **prune** stale/low-velocity ones on each run.
4. **Produced topics:** Keep `"Made"` items out of Top Trends; if the user asks for produced topics, bind `data_endpoint` to `/api/topics/made` (`mcp-studio-board.list_made_topics`).
