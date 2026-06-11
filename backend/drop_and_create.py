from app.core.database import engine, Base
from app.models.schema import User, JobTarget

print("Dropping and recreating database tables in Supabase...")
try:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Tables dropped and recreated successfully!")
except Exception as e:
    print(f"Error creating tables: {e}")
