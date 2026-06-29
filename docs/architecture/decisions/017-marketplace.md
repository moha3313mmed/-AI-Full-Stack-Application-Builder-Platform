# ADR 017: Marketplace Architecture

## Status

Accepted

## Context

The platform needs a marketplace for discovering, publishing, and installing plugins. We need a system that supports:

- Browsing and searching plugins with filtering by category, sorting by popularity/rating
- Publishing plugins with metadata, descriptions, icons, and screenshots
- User reviews and ratings for community feedback
- Download tracking for popularity metrics
- Category-based organization for discoverability
- Version management for safe upgrades

The main options considered were:

1. **External marketplace platform**: Use an existing marketplace service (npm-like registry)
2. **Built-in marketplace with internal storage**: Full marketplace implementation within the platform
3. **Federated marketplace**: Multiple marketplace sources aggregated through a common API
4. **Curated catalog**: Admin-managed list of approved plugins without open publishing

## Decision

We will implement a **built-in marketplace with internal storage, user reviews, and category-based browsing**:

### Listing Management

- Each plugin can have one marketplace listing (one-to-one relationship)
- Listings include title, description, short description, category, tags, icon, and screenshots
- Publishers provide metadata when publishing; the system tracks downloads and ratings automatically
- Categories are predefined: AI Agent, Integration, Theme, Analytics, Security, Deployment, Utility

### Search and Discovery

- Full-text search across title and description fields
- Category filtering for focused browsing
- Sort options: newest (default), most popular (downloads), highest rated
- Paginated results with configurable limit and offset

### Reviews and Ratings

- Users can submit ratings (1-5) with title and content
- Average rating is recalculated on each new review submission
- Review count is maintained for listing display
- Reviews are paginated and sorted by newest first

### Download Tracking

- Download count is atomically incremented on each plugin installation
- Popular sort order uses download count for ranking
- No per-user download history (privacy-conscious design)

### Publishing Flow

- Plugin must exist before a listing can be created
- Duplicate listings for the same plugin are prevented
- Author attribution links listings to the publishing user
- Listings include timestamps for published and last updated dates

## Consequences

### Positive

- **Discoverability**: Category browsing and search make it easy to find relevant plugins
- **Community trust**: Reviews and ratings provide social proof for quality assessment
- **Simplicity**: Built-in marketplace eliminates external service dependencies
- **Analytics**: Download tracking provides insight into plugin popularity

### Negative

- **Moderation**: Open publishing requires review processes to prevent malicious or low-quality listings
- **Scalability**: Internal storage may not scale for very large plugin ecosystems
- **Content management**: Icon and screenshot hosting adds storage requirements
- **Gaming**: Ratings and downloads can potentially be manipulated

### Mitigations

- Publisher verification can be added as a gating mechanism for new listings
- Database indexing on search fields ensures query performance at scale
- Screenshots and icons use URL references, allowing external CDN hosting
- Rate limiting on reviews prevents rating manipulation from single users
- Admin endpoints (future) will allow removal of policy-violating listings
