package com.brewery.digitaltwin.config;

import com.brewery.digitaltwin.entity.*;
import com.brewery.digitaltwin.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;



import java.time.LocalDateTime;
import java.util.Random;

/**
 * 数据初始化器 - 在应用启动后初始化演示数据
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final PitSensorDataRepository pitSensorDataRepository;
    private final DeviceDataRepository deviceDataRepository;

    private final PitRepository pitRepository;
    private final DeviceRepository deviceRepository;
    private final ProductionBatchRepository batchRepository;
    
    @Value("${app.total-pits:100}")
    private int totalPits;
    
    @Value("${app.total-devices:50}")
    private int totalDevices;
    
    private final Random random = new Random();
    
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            long count = pitRepository.count();
            if (count == 0) {
                log.info("初始化演示数据...");
                initPits();
                initDevices();
                initBatches();
                initHistoryData();//新增
                log.info("演示数据初始化完成: {} 窖池, {} 设备", totalPits, totalDevices);
            } else {
                log.info("数据库已有数据 ({} 窖池)，跳过初始化", count);
            }
        } catch (Exception e) {
            log.error("数据初始化失败: {}", e.getMessage(), e);
        }
    }
    
    private void initPits() {
        String[] zones = {"A", "B", "C", "D"};
        int pitIndex = 1;
        for (String zone : zones) {
            for (int row = 1; row <= 5; row++) {
                for (int col = 1; col <= 5; col++) {
                    if (pitIndex > totalPits) return;
                    
                    Pit pit = new Pit();
                    pit.setPitNo(String.format("%s-%03d", zone, pitIndex));
                    pit.setZone(zone);
                    pit.setRow(row);
                    pit.setCol(col);
                    pit.setStatus("normal");
                    pit.setPitAge(random.nextInt(100) + 10);
                    pit.setFermentationDay(random.nextInt(60));
                    pit.setGrapeType(random.nextBoolean() ? "高粱" : "小麦");
                    
                    pitRepository.save(pit);
                    pitIndex++;
                }
            }
        }
    }
    
    private void initDevices() {
        String[] types = {"pump", "motor", "sensor", "robot", "conveyor"};
        String[] typeNames = {"泵", "电机", "传感器", "机器人", "输送带"};
        String[] locations = {"A区", "B区", "C区", "D区", "中控室"};
        
        for (int i = 1; i <= totalDevices; i++) {
            int typeIndex = random.nextInt(types.length);
            Device device = new Device();
            device.setDeviceNo(String.format("%s-%03d", types[typeIndex].substring(0, 1).toUpperCase(), i));
            device.setName(typeNames[typeIndex] + "-" + i);
            device.setType(types[typeIndex]);
            device.setLocation(locations[random.nextInt(locations.length)]);
            device.setStatus("running");
            device.setRunningHours((double) random.nextInt(10000));
            
            deviceRepository.save(device);
        }
    }
    
    private void initBatches() {
        for (int i = 1; i <= 5; i++) {
            ProductionBatch batch = new ProductionBatch();
            batch.setBatchNo(String.format("BATCH-%s-%03d", 
                LocalDateTime.now().getYear(), i));
            batch.setProductType("浓香型白酒");
            batch.setTargetVolume(100.0 + random.nextInt(100));
            batch.setStatus(i <= 2 ? "in_progress" : "planning");
            if (i <= 2) {
                batch.setStartDate(LocalDateTime.now().minusDays(random.nextInt(10)));
            }
            batchRepository.save(batch);
        }
    }

    // 新增的辅助方法
    private void initHistoryData() {
        log.info("正在生成初始历史监测数据...");
        LocalDateTime now = LocalDateTime.now();

        // 1. 为每个窖池生成过去 24 小时的监测数据
        pitRepository.findAll().forEach(pit -> {
            for (int i = 24; i >= 0; i--) {
                PitSensorData data = new PitSensorData();
                data.setPitId(pit.getId());

                // --- 补全所有字段，防止空指针 ---
                data.setTemperature(20.0 + random.nextDouble() * 10.0);
                data.setHumidity(40.0 + random.nextDouble() * 30.0);
                data.setPhValue(3.5 + random.nextDouble() * 1.5);

                // 修复：必须初始化这些字段，否则 SimulatorService 会报空指针
                data.setAcidity(0.5 + random.nextDouble() * 1.0); // 0.5 - 1.5
                data.setMoisture(50.0 + random.nextDouble() * 20.0); // 50% - 70%
                data.setAlcohol(5.0 + random.nextDouble() * 10.0);   // 5% - 15%

                data.setRecordedAt(now.minusHours(i));
                pitSensorDataRepository.save(data);
            }
        });

        // 2. 为每个设备生成数据 (这部分应该没问题，但建议检查)
        deviceRepository.findAll().forEach(device -> {
            if ("running".equals(device.getStatus())) {
                for (int i = 24; i >= 0; i--) {
                    DeviceData data = new DeviceData();
                    data.setDeviceId(device.getId());
                    data.setCurrent(10.0 + random.nextDouble() * 5.0);
                    data.setTemperature(40.0 + random.nextDouble() * 20.0);
                    data.setVibration(0.5 + random.nextDouble() * 2.0);
                    // 补全 SimulatorService 可能用到的字段
                    data.setPower(10.0 + random.nextDouble() * 10.0);
                    data.setSpeed(1000.0 + random.nextDouble() * 500.0);

                    data.setRecordedAt(now.minusHours(i));
                    deviceDataRepository.save(data);
                }
            }
        });
    }
}
