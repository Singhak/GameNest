import { Module, Global } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Global() // Make FirebaseService available globally
@Module({
  providers: [
    FirebaseService, // FirebaseService will handle the initialization
    // No need for a custom provider here, FirebaseService handles it internally
  ],
  exports: [FirebaseService], // Export the service so other modules can use it
})
export class FirebaseModule {}