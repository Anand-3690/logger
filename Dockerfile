FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy pre-compiled frontend and standalone server bundle
COPY dist ./dist
COPY dist-server/server.cjs ./server.cjs

EXPOSE 3000

# Start server with integrated 24/7 notification scheduler
CMD ["node", "server.cjs"]
