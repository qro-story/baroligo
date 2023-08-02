import { Controller, Post } from '@nestjs/common';
import { AligoService } from 'src/aligo-sms/aligo-sms.service';
import { MessageService } from './message.service';

@Controller('message')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly aligoService: AligoService,
  ) {}
}
