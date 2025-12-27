[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Verify the project is working using the feedback tool
[x] 4. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
[x] 5. Fix deployment startup timeout - restructured server startup to listen on port 5000 immediately
[x] 6. Fix security headers - moved health check endpoints after Helmet middleware so they include all security headers