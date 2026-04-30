import requests

url = "http://localhost:8000/api/match"
data = {
  "resume_data": {
    "skills": ["Python", "FastAPI", "React", "Docker"]
  },
  "job_description": "Looking for a backend engineer with experience in REST APIs, Kubernetes, and SQL."
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
