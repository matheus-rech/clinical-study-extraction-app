"""Test health check endpoint"""
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


def test_health_endpoint_exists(client):
    """Test that health endpoint exists and returns 200 OK"""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_endpoint_response_format(client):
    """Test that health endpoint returns correct format"""
    response = client.get("/health")
    assert response.status_code == 200
    
    data = response.json()
    assert "status" in data
    assert "service" in data
    assert "version" in data
    
    # Verify status is 'ok' as specified in the problem statement
    assert data["status"] == "ok"
    assert data["service"] == "PDF Processing API"


def test_health_endpoint_can_be_called_multiple_times(client):
    """Test that health endpoint is reliable and can be called multiple times"""
    for i in range(5):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
