import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from './firebase/firebase.module';
import configuration from './common/configs/configuration';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/gamenext'),
    MongooseModule.forFeature(),
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true, // Makes the ConfigModule available throughout the application
      load: [configuration], // Load our custom configuration
      envFilePath: '.env', // Specify the path to your .env file
    }),
    AuthModule,
    UsersModule,
    FirebaseModule, // Import the Firebase module
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }