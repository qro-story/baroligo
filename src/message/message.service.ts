import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MessageService {
  constructor(private readonly prismaService: PrismaService) {}

  // 어디에 메시지에 보낼 지 판단해야할 필요가 있다.
  // 예약번호의 최댓값을 저장한다.
  async createMaxReservationNum(reservationNum: number) {
    await this.prismaService.messageBase.create({
      data: { maxReservationNum: reservationNum },
    });
  }
  // messageBase 테이블에서 최대 예약번호 가져오기
  async getMaxReservationNum() {
    const reservationMaxNum = await this.prismaService.messageBase.aggregate({
      _max: {
        maxReservationNum: true,
      },
    });
    return reservationMaxNum._max.maxReservationNum;
  }

  async getPlaceInfoOfSms(placeDescription: string) {
    // [역도보3분]신촌 연습실 제이엔터, C홀 이 있으면 이는 [역도보3분]신촌연습실제이엔터C홀 로 변경된다.
    const placeString = placeDescription.replace(/,| /g, '');

    return await this.prismaService.place.findUnique({
      where: { description: placeString },
      select: { message: true },
    });
  }

  // 모든 장소 정보를 가져오기
  async getPlaces() {
    // [역도보3분]신촌 연습실 제이엔터, C홀 이 있으면 이는 [역도보3분]신촌연습실제이엔터C홀 로 변경된다.

    return await this.prismaService.place.findMany();
  }
}
