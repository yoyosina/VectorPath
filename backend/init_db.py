from app.core.database import engine, Base
from app.models.schema import User, JobTarget

print("Creating database tables in Supabase...")
try:
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")
except Exception as e:
    print(f"Error creating tables: {e}")
