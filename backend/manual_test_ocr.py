import json
import io
import uuid
from fastapi.testclient import TestClient
from app.main import app
from tests.test_ocr_extraction import (
    load_fixture, _create_test_user, _get_token, TestScheme, TestApplication, TestBase
)
from tests.conftest import TestingSessionLocal, engine
from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import UserRole
from app.services.scheme_config_validator import validate_scheme_config

# Create tables
TestBase.metadata.create_all(bind=engine)

db = TestingSessionLocal()

# Create SUPER_ADMIN user
super_admin = _create_test_user(db, 'admin@scholarship.gov.in', UserRole.SUPER_ADMIN)

# Create authenticated client
def override_get_db():
    try:
        yield db
    finally:
        pass

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)
token = _get_token(super_admin)
client.headers.update({'Authorization': f'Bearer {token}'})

# Load fixtures
nfst_config = load_fixture('nfst_config.json')
nfst_config['name'] = 'National Fellowship for ST Students'
nfst_config['description'] = 'Fellowship for Scheduled Tribe students pursuing PhD'

# Create NFST scheme via API
print('=== 1. Create NFST scheme ===')
r = client.post('/api/schemes', json={
    'code': 'NFST',
    'name': nfst_config['name'],
    'description': nfst_config['description'],
    'config': nfst_config,
    'is_active': True,
})
print('Status:', r.status_code)
scheme_id = r.json()['id']

# Create application
from app.services.scheme_config_validator import validate_scheme_config
validated_config = validate_scheme_config(nfst_config)
app_obj = TestApplication(
    scheme_id=uuid.UUID(scheme_id),
    applicant_name='Test Applicant',
    applicant_email='test@example.com',
    applicant_data={'age': 25, 'annual_income': 300000, 'category': 'ST'},
    current_state=validated_config.initial_state,
)
db.add(app_obj)
db.commit()
db.refresh(app_obj)
print('Created application:', app_obj.id)

# Upload the sample file
print()
print('=== 2. Upload sample PNG as caste_certificate ===')
with open('D:\\SCST\\test_sample.png', 'rb') as f:
    file_content = f.read()

files = {'file': ('test_sample.png', io.BytesIO(file_content), 'image/png')}
data = {'doc_type': 'caste_certificate'}

r = client.post(
    f'/api/applications/{app_obj.id}/documents',
    files=files,
    data=data,
)
print('Status:', r.status_code)
result = r.json()
print(json.dumps(result, indent=2))

# Verify in MinIO by getting presigned URL
print()
print('=== 3. Verify document via presigned URL ===')
doc_id = result['id']
r = client.get(f'/api/applications/documents/{doc_id}')
print('Status:', r.status_code)
doc = r.json()
print('Document ID:', doc['id'])
print('Download URL:', doc['download_url'])
print('Status:', doc['status'])
print('Doc type:', doc['doc_type'])
print()
print('=== 4. Extracted Fields ===')
print(json.dumps(doc.get('extracted_fields', {}), indent=2))

app.dependency_overrides.clear()
db.close()
TestBase.metadata.drop_all(bind=engine)