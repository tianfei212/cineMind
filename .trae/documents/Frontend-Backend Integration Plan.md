Based on your requirements, I have updated the plan to include the backend setup and environment management.

### 1. Documentation & Project Structure
*   **Frontend Documentation (`fronted/BACKEND_API.md`)**:
    *   Create the interface definition file in Chinese, specifying the 5 core endpoints (MindMap, Generate, Status, Gallery, Full Image).
*   **Backend Documentation (`backend/docs/API_DEV.md`)**:
    *   Create a corresponding development document in the new backend directory.
    *   This will include implementation details (e.g., database models, response schemas) based on the frontend contract.
*   **Update `PROJECT_STRUCTURE.md`**:
    *   Add entries for the new `backend/` directory and documentation files.

### 2. Backend Environment Setup (Conda)
*   **Create Environment**:
    *   Create a new Conda environment named `cinemind_backend` with Python 3.10.
    *   Command: `conda create -n cinemind_backend python=3.10 -y`
*   **Install Dependencies**:
    *   Install **FastAPI** and **Uvicorn** for the web server.
    *   Install other necessary libs (e.g., `pydantic` for validation).

### 3. Backend Implementation (Python/FastAPI)
*   **Directory Structure**:
    *   Create `backend/main.py` (Entry point).
    *   Create `backend/routers/` (API routes).
    *   Create `backend/models/` (Data models).
*   **API Implementation**:
    *   Implement the 5 endpoints defined in the documentation.
    *   **Mock Logic**: Initially return mock data (e.g., static MindMap nodes, dummy task status) to verify connectivity.

### 4. Frontend Integration
*   **Service Layer**: Update `fronted/services/api.ts` to connect to `http://localhost:8000`.
*   **Component Logic**: Refactor `MindMap.tsx`, `App.tsx`, and `RightPanel.tsx` to use the real API calls instead of local static data.

### 5. Verification
*   Start the backend server using the Conda environment.
*   Start the frontend dev server.
*   Verify the full flow: Expand Node -> Submit Task -> Poll Status -> View Gallery.

I will proceed with **Step 1 & 2** (Documentation & Environment Setup) immediately after your confirmation, followed by the code implementation.
