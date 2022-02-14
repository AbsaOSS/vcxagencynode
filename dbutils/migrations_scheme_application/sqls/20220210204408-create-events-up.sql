CREATE PROCEDURE prune_msgs()
BEGIN
    DELETE LOW_PRIORITY FROM messages WHERE status_code = 'MS-105' OR status_code = 'MS-106';
END;


CREATE EVENT msgs_cleanup
    ON SCHEDULE EVERY 10 MINUTE
    ON COMPLETION PRESERVE
    COMMENT 'Cleanup processed messages (in states MS-105 or MS-106)'
    DO
        CALL prune_msgs();
