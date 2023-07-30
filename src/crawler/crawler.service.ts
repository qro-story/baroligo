import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { Browser, ElementHandle, Page } from 'puppeteer';
import { MessageService } from 'src/message/message.service';
import { ReservationInfo } from 'src/reservation/dtos/reservation-info.dto';
import { ReservationService } from 'src/reservation/reservation.service';

@Injectable()
export class CrawlerService {
  constructor(
    private readonly configService: ConfigService,
    private readonly reservationService: ReservationService,
    private readonly messageService: MessageService,
  ) {}
  private SPACE_URL = this.configService.get<string>('SPACE_URL');
  private SPACE_EMAIL = this.configService.get<string>('SPACE_EMAIL');
  private SPACE_PASSWORD = this.configService.get<string>('SPACE_PASSWORD');

  async crawlingReservationInfos() {
    // 기존의 가장 높은 예약 번호
    let reservationMaxNum = await this.messageService.getMaxReservationNum();
    let browser: Browser | undefined;
    let page: Page;
    try {
      const result = [];
      const url: string = this.SPACE_URL;
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      page = await browser.newPage();

      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const userEmail = this.SPACE_EMAIL;
      const passWord = this.SPACE_PASSWORD;

      // 아이디와 비밀번호 입력
      await page.type('#email', userEmail); // 실제 웹사이트에 맞게 셀렉터 수정 필요
      await page.type('#pw', passWord); // 실제 웹사이트에 맞게 셀렉터 수정 필요

      // 로그인 버튼 클릭
      // await page.click('#loginButton'); // 실제 웹사이트에 맞게 셀렉터 수정 필요
      const buttons = await page.$x('//fieldset/button[last()]');
      if (buttons.length > 0) {
        const buttonElement = buttons[0] as ElementHandle<Element>;
        await buttonElement.click();
      } else {
        console.error(
          'Button with the text "호스트 이메일로 로그인" not found',
        );
      }

      await page.waitForNavigation({});
      const spanElements = await page.$x(
        '//span[contains(@class, "sp_icon") and contains(@class, "ico_menu")]',
      );
      if (spanElements.length > 0) {
        const spanElement = spanElements[0] as ElementHandle<Element>;

        await spanElement.click();
        // 원하는 작업 수행
      } else {
        console.error('Span with classes sp_icon and ico_menu not found');
      }

      // 사이드바가 렌더링 할 때까지 정리
      await page.waitForSelector('div.menu_top', { timeout: 15000 });
      const liElement = await page.waitForSelector('.menu_top li:first-child', {
        visible: true,
        timeout: 5000,
      });

      if (liElement) {
        await liElement.click();
      } else {
        console.error(
          'First "li" inside element with class "menu_top" not found',
        );
      }

      await page.waitForNavigation();

      await page.waitForSelector(
        'div.reservation_list div.list_box_wrap article',
        { timeout: 10000 },
      ); // 10초 동안 최대 대기

      // "sub_detail" 클래스를 갖는 모든 dd 태그를 가져옴
      const details = await page.$$('article.list_box');

      // 각각의 promise.all로 돌면서 반환 준비를 한다.
      await Promise.all(
        details.map(async (detail) => {
          const tagReservation = await this.getInfoAboutReservation(
            detail,
            'tag',
          ); // 예약 확정 여부
          const placeReservation = await this.getInfoAboutReservation(
            detail,
            'place',
          ); // 예약 공간 정보
          const dateReservation = await this.getInfoAboutReservation(
            detail,
            'date',
          ); // 예약 날짜 시간
          const nameReservation = await this.getInfoAboutReservation(
            detail,
            'user',
          ); // 예약자명
          const telReservation = await this.getInfoAboutReservation(
            detail,
            'tel',
          ); // 예약자 전화번호
          const reservationNum = await this.getInfoAboutReservation(
            detail,
            'reservation_num',
          ); // 예약번호
          const price = await this.getInfoAboutReservation(detail, 'price'); // 예약자 전화번호

          /**
           * 1. 데이터베이스에 저장되어 있는 reservation에 정보들을 가져온다.
           * 2. 유저를 구별할 수 있는것은 이름과 전화번호의 조합으로 식별 가능하다.
           * 3. 장소를 구별하기 위해선 description이 그 정보가 된다.
           */

          const reservation = new ReservationInfo(
            nameReservation,
            telReservation,
            tagReservation,
            dateReservation,
            placeReservation,
            reservationNum,
            price,
          );

          if (reservation.phoneNumber) {
            await this.reservationService.postReservation(reservation);
          }

          if (reservation.reservationNum > reservationMaxNum) {
            if (tagReservation == '예약확정') result.push(reservation);
          }
          // reservation.displayInfo();
        }),
      );
      await page.close(); // 페이지를 닫습니다. 페이지 관련 리소스가 해제됩니다.
      await browser.close(); // 브라우저를 닫습니다. 브라우저 관련 리소스가 해제됩니다.
      return result;
    } catch (error) {
      console.error('Error logging in:', error);
      // 에러가 발생하면 다시 호출하도록 한다.

      await page.close(); // 페이지를 닫습니다. 페이지 관련 리소스가 해제됩니다.
      await browser.close(); // 브라우저를 닫습니다. 브라우저 관련 리소스가 해제됩니다.

      await this.crawlingReservationInfos();
    }
  }

  async getInfoAboutReservation(
    node: ElementHandle<HTMLElement>,
    qeurySelector: string,
  ) {
    try {
      return await (
        await node.$(`.${qeurySelector}`)
      ).evaluate((v) => v.textContent);
    } catch (error) {
      console.log(` no data in ${qeurySelector}`);
    }
  }
}
