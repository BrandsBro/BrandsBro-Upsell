#!/bin/bash
echo "Killing processes on ports 9293 and 3457..."
lsof -ti:9293 | xargs kill -9 2>/dev/null
lsof -ti:3457 | xargs kill -9 2>/dev/null
echo "Starting shopify app dev..."
shopify app dev
